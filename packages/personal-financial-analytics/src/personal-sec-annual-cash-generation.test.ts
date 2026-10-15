import type {
  PersonalSecAnnualCashAbsence,
  PersonalSecAnnualCashMetricEvidenceDto,
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualCashResolutionInput,
  PersonalSecAnnualScanStatus,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePersonalOperatingCashFlowLessPpePurchases } from "./personal-cash-generation";
import {
  resolvePersonalSecAnnualCashGeneration,
  resolvePersonalSecAnnualCashHistory,
  type PersonalSecAnnualCashHistoryReason,
} from "./personal-sec-annual-cash-generation";

type Row = PersonalSecAnnualCashObservationDto;
type Input = PersonalSecAnnualCashResolutionInput;
const accession = "0000999999-26-000001";
const submissionsUrl = "https://data.sec.gov/submissions/CIK0000000042.json";

function row(index: number, purchases = false): Row {
  const common = {
    id: `sec-fact:${index.toString(16).padStart(64, "0")}` as const,
    taxonomy: "us-gaap" as const,
    unit: "USD" as const,
    value: purchases ? "30" : "100",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    durationDays: 365,
    periodBasis: "unresolved" as const,
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber: accession,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${purchases ? "PaymentsToAcquirePropertyPlantAndEquipment" : "NetCashProvidedByUsedInOperatingActivities"}/units/USD/0`,
    filing: {
      status: "matched" as const,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`,
    },
  };
  return purchases
    ? {
        ...common,
        metric: "ppe_purchases",
        concept: "PaymentsToAcquirePropertyPlantAndEquipment",
      }
    : {
        ...common,
        metric: "operating_cash_flow",
        concept: "NetCashProvidedByUsedInOperatingActivities",
      };
}

function metric(
  observations: readonly Row[],
  absence: PersonalSecAnnualCashAbsence | null = null,
): PersonalSecAnnualCashMetricEvidenceDto {
  const count = observations.length;
  return {
    scan: {
      status: "available",
      absence,
      coverage: {
        full: {
          candidateRows: count,
          inspectedRows: count,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: count,
        },
        selected: count,
        otherAccessions: 0,
        returned: count,
        omittedSelected: 0,
      },
    },
    observations,
  };
}

function input(operating = [row(1)], purchases = [row(2, true)]) {
  return {
    cik: "0000000042",
    generation: {
      definitionVersion: "4.0.0",
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
          sourceUrl: submissionsUrl,
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
    cashGeneration: {
      operatingCashFlow: metric(operating),
      ppePurchases: metric(purchases),
    },
  } satisfies Input;
}

describe("Annual cash generation", () => {
  it("returns independent exact amounts and both input references without a revenue basis", () => {
    const packet = input();
    const before = structuredClone(packet);
    const result = resolvePersonalSecAnnualCashGeneration(packet);
    expect(result.operatingCashFlow).toMatchObject({
      status: "available",
      value: "100",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      accessionNumber: accession,
      currentUseEligible: true,
    });
    expect(result.ppePurchases).toMatchObject({
      status: "available",
      value: "30",
    });
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "70",
      observationIds: [row(1).id, row(2, true).id],
    });
    expect(result.utilityAge).toMatchObject({
      endAgeDays: 263,
      withinWindow: true,
    });
    expect(packet).toEqual(before);
    expect(Object.isFrozen(packet)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.operatingCashFlow.observationIds)).toBe(true);
  });

  it.each([
    ["-5", "0", "-5"],
    ["0", "0", "0"],
    ["5", "8", "-3"],
    ["100.000000000000000001", "100", "0.000000000000000001"],
  ])(
    "preserves exact signed cash difference %s minus %s",
    (ocf, ppe, difference) => {
      const result = resolvePersonalSecAnnualCashGeneration(
        input([{ ...row(1), value: ocf }], [{ ...row(2, true), value: ppe }]),
      );
      expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
        status: "available",
        value: difference,
      });
    },
  );

  it("shows a negative PP&E report but refuses its subtraction", () => {
    const result = resolvePersonalSecAnnualCashGeneration(
      input(undefined, [{ ...row(2, true), value: "-1" }]),
    );
    expect(result.ppePurchases).toMatchObject({
      status: "available",
      value: "-1",
    });
    expect(result.operatingCashFlowLessPpePurchases).toEqual({
      status: "unavailable",
      reason: "unsupported_sign",
      observationIds: [row(1).id, row(2, true).id],
    });
  });

  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "keeps OCF when PP&E is %s",
    (absence) => {
      const packet = input();
      packet.cashGeneration.ppePurchases = metric([], absence);
      const result = resolvePersonalSecAnnualCashGeneration(packet);
      expect(result.operatingCashFlow.status).toBe("available");
      expect(result.ppePurchases).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
    },
  );

  it.each([
    "source_unavailable",
    "invalid_response",
    "candidate_limit",
  ] satisfies PersonalSecAnnualScanStatus[])(
    "isolates an OCF %s scan",
    (status) => {
      const packet = input();
      packet.cashGeneration.operatingCashFlow = {
        scan: { status, absence: null, coverage: null },
        observations: [],
      };
      const result = resolvePersonalSecAnnualCashGeneration(packet);
      expect(result.operatingCashFlow).toMatchObject({
        status: "unavailable",
        reason: status,
      });
      expect(result.ppePurchases.status).toBe("available");
    },
  );

  it("refuses counted invalid OCF rows while retaining inspected valid references", () => {
    const packet = input();
    const scan = packet.cashGeneration.operatingCashFlow.scan;
    if (scan.status !== "available") throw new Error("Fixture scan");
    packet.cashGeneration.operatingCashFlow = {
      ...packet.cashGeneration.operatingCashFlow,
      scan: {
        ...scan,
        coverage: {
          ...scan.coverage,
          full: {
            ...scan.coverage.full,
            candidateRows: 2,
            inspectedRows: 2,
            invalidRows: 1,
          },
        },
      },
    };
    const result = resolvePersonalSecAnnualCashGeneration(packet);
    expect(result.operatingCashFlow).toEqual({
      status: "unavailable",
      reason: "invalid_source_rows",
      observationIds: [row(1).id],
    });
    expect(result.ppePurchases.status).toBe("available");
  });

  it("refuses selected overflow without spending the other metric's allowance", () => {
    const packet = input();
    packet.cashGeneration.operatingCashFlow = {
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
    };
    const result = resolvePersonalSecAnnualCashGeneration(packet);
    expect(result.operatingCashFlow).toMatchObject({
      reason: "selected_report_overflow",
    });
    expect(result.ppePurchases.status).toBe("available");
  });

  it("admits all 100 selected rows at the independent 10,000-candidate boundary", () => {
    const rows = Array.from({ length: 100 }, (_, index) => row(index + 3));
    const packet = input(rows);
    const original = packet.cashGeneration.operatingCashFlow;
    if (original.scan.status !== "available") throw new Error("Fixture scan");
    const scan = {
      ...original.scan,
      coverage: {
        ...original.scan.coverage,
        full: {
          ...original.scan.coverage.full,
          candidateRows: 10_000,
          inspectedRows: 10_000,
          duplicateRows: 9_900,
        },
      },
    };
    packet.cashGeneration.operatingCashFlow = { ...original, scan };
    const result = resolvePersonalSecAnnualCashGeneration(packet);
    expect(result.operatingCashFlow).toMatchObject({
      status: "available",
      value: "100",
      observationIds: rows.map((source) => source.id),
    });
    expect(result.ppePurchases.status).toBe("available");
    scan.coverage.full.candidateRows++;
    scan.coverage.full.inspectedRows++;
    scan.coverage.full.duplicateRows++;
    expect(() => resolvePersonalSecAnnualCashGeneration(packet)).toThrow(
      TypeError,
    );
  });

  it("keeps comparative periods as evidence without choosing them over the report end", () => {
    const old = {
      ...row(3),
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      durationDays: 366,
      value: "999",
    };
    const result = resolvePersonalSecAnnualCashGeneration(input([old, row(1)]));
    expect(result.operatingCashFlow).toMatchObject({
      value: "100",
      observationIds: [row(1).id],
    });
    expect(
      resolvePersonalSecAnnualCashGeneration(input([old])).operatingCashFlow,
    ).toMatchObject({ reason: "no_report_period" });
  });

  it("retains all agreeing references and refuses conflicting values or annual starts", () => {
    const extra = { ...row(3), frame: "CY2025" };
    const result = resolvePersonalSecAnnualCashGeneration(
      input([row(1), extra]),
    );
    expect(result.operatingCashFlow.observationIds).toEqual([
      row(1).id,
      extra.id,
    ]);
    expect(
      resolvePersonalSecAnnualCashGeneration(
        input([row(1), { ...extra, value: "101" }]),
      ).operatingCashFlow,
    ).toMatchObject({ reason: "ambiguous_value" });
    expect(
      resolvePersonalSecAnnualCashGeneration(
        input([
          row(1),
          { ...extra, startDate: "2025-01-02", durationDays: 364 },
        ]),
      ).operatingCashFlow,
    ).toMatchObject({ reason: "ambiguous_period" });
  });

  it("withholds only the difference when independently valid annual periods differ", () => {
    const result = resolvePersonalSecAnnualCashGeneration(
      input(undefined, [
        { ...row(2, true), startDate: "2025-01-02", durationDays: 364 },
      ]),
    );
    expect(result.operatingCashFlow.status).toBe("available");
    expect(result.ppePurchases.status).toBe("available");
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      reason: "period_mismatch",
    });
  });

  it.each([
    [{ filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [{ form: "10-Q" }, "unsupported_form"],
    [{ startDate: null, durationDays: null }, "invalid_annual_period"],
    [{ durationDays: 366 }, "invalid_annual_period"],
    [{ startDate: "2025-03-01", durationDays: 306 }, "invalid_annual_period"],
  ] as const)("preserves Annual row refusal %#", (change, reason) => {
    const result = resolvePersonalSecAnnualCashGeneration(
      input([{ ...row(1), ...change }]),
    );
    expect(result.operatingCashFlow).toMatchObject({
      status: "unavailable",
      reason,
    });
    expect(result.ppePurchases.status).toBe("available");
  });

  it.each([
    [
      { acceptedAt: "2026-02-02T16:00:00.000Z" },
      "filing_unmatched_or_conflicted",
    ],
    [{ reportDate: "2024-12-31" }, "report_end_mismatch"],
    [
      { sourceUrl: "https://data.sec.gov/submissions/CIK0000000007.json" },
      "filing_unmatched_or_conflicted",
    ],
    [{ sourceUrl: submissionsUrl }, "filing_unmatched_or_conflicted"],
    [
      {
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/7/${accession}-index.htm`,
      },
      "filing_unmatched_or_conflicted",
    ],
    [
      {
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/42/0000999999-26-000002-index.htm",
      },
      "filing_unmatched_or_conflicted",
    ],
    [{ status: "metadata_conflict" }, "filing_unmatched_or_conflicted"],
  ] as const)("refuses substituted filing coordinates %#", (change, reason) => {
    const original = row(1);
    const result = resolvePersonalSecAnnualCashGeneration(
      input([{ ...original, filing: { ...original.filing, ...change } }]),
    );
    expect(result.operatingCashFlow).toMatchObject({ reason });
  });

  it("retains exact historical values beyond current-use age without borrowing income eligibility", () => {
    const packet = input();
    const oldRows = [row(1), row(2, true)].map((source) => ({
      ...source,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      durationDays: 366,
      filing: { ...source.filing, reportDate: "2024-12-31" },
    }));
    const result = resolvePersonalSecAnnualCashGeneration({
      ...packet,
      target: {
        ...packet.target,
        status: "target",
        accessionNumber: accession,
        form: "10-K",
        filedDate: "2026-02-01",
        acceptedAt: "2026-02-01T16:00:00.000Z",
        reportDate: "2024-12-31",
      },
      cashGeneration: {
        operatingCashFlow: metric([oldRows[0]!]),
        ppePurchases: metric([oldRows[1]!]),
      },
    });
    expect(result.operatingCashFlow).toMatchObject({
      status: "available",
      value: "100",
      currentUseEligible: false,
    });
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      value: "70",
      currentUseEligible: false,
    });
    expect(result.utilityAge?.withinWindow).toBe(false);
  });

  it("withholds all cash on a failed shared source or invalid generation clock", () => {
    const packet = input();
    const failed = {
      ...packet,
      generation: {
        ...packet.generation,
        sources: {
          ...packet.generation.sources,
          submissions: {
            ...packet.generation.sources.submissions,
            status: "upstream_unavailable" as const,
          },
        },
      },
    };
    expect(
      resolvePersonalSecAnnualCashGeneration(failed).ppePurchases,
    ).toMatchObject({ reason: "source_unavailable" });
    expect(
      resolvePersonalSecAnnualCashGeneration({
        ...packet,
        generation: {
          ...packet.generation,
          completedAt: "2026-09-19T06:00:00.000Z",
        },
      }).operatingCashFlow,
    ).toMatchObject({ reason: "invalid_clock" });
  });

  it("withholds cash from stale source captures even when the filing is recent enough", () => {
    const packet = input();
    const result = resolvePersonalSecAnnualCashGeneration({
      ...packet,
      generation: {
        ...packet.generation,
        completedAt: "2026-09-28T06:00:03.000Z",
      },
    });
    expect(result.operatingCashFlow).toMatchObject({ reason: "source_stale" });
    expect(result.ppePurchases).toMatchObject({ reason: "source_stale" });
    expect(result.utilityAge?.withinWindow).toBe(false);
  });

  it("does not treat a future filing as merely outside current-use age", () => {
    const packet = input();
    const result = resolvePersonalSecAnnualCashGeneration({
      ...packet,
      target: { ...packet.target, filedDate: "2026-09-21" },
    });
    expect(result.operatingCashFlow).toMatchObject({
      reason: "future_or_inconsistent_dates",
    });
    expect(result.ppePurchases).toMatchObject({
      reason: "future_or_inconsistent_dates",
    });
  });

  it("keeps an unresolved target explicit rather than selecting an available older filing", () => {
    const empty = metric([]);
    if (empty.scan.status !== "available") throw new Error("Fixture scan");
    const unresolved = {
      ...empty,
      scan: {
        ...empty.scan,
        coverage: {
          ...empty.scan.coverage,
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        },
      },
    };
    const result = resolvePersonalSecAnnualCashGeneration({
      ...input(),
      target: { status: "unresolved", reason: "no_observed_annual_target" },
      cashGeneration: {
        operatingCashFlow: unresolved,
        ppePurchases: unresolved,
      },
    });
    expect(result.operatingCashFlow).toMatchObject({
      reason: "target_unresolved",
    });
    expect(result.utilityAge).toBeNull();
  });

  it("rejects substituted accession, contradictory counts and duplicate source IDs", () => {
    expect(() =>
      resolvePersonalSecAnnualCashGeneration(
        input([{ ...row(1), accessionNumber: "0000999999-26-000002" }]),
      ),
    ).toThrow(TypeError);
    expect(() =>
      resolvePersonalSecAnnualCashGeneration(input([row(1), row(1)])),
    ).toThrow(TypeError);
    const packet = input();
    const original = packet.cashGeneration.operatingCashFlow;
    if (original.scan.status !== "available") throw new Error("Fixture scan");
    packet.cashGeneration.operatingCashFlow = {
      ...original,
      scan: {
        ...original.scan,
        coverage: { ...original.scan.coverage, returned: 0 },
      },
    };
    expect(() => resolvePersonalSecAnnualCashGeneration(packet)).toThrow(
      TypeError,
    );
  });
});

describe("shared exact cash subtraction", () => {
  it("supports the 64-character input boundary and stays independent of global Decimal config", () => {
    const before = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      minE: Decimal.minE,
      maxE: Decimal.maxE,
    };
    try {
      Decimal.set({
        precision: 2,
        rounding: Decimal.ROUND_DOWN,
        minE: -3,
        maxE: 3,
      });
      expect(
        calculatePersonalOperatingCashFlowLessPpePurchases("9".repeat(64), "1"),
      ).toEqual({ status: "available", value: `${"9".repeat(63)}8` });
      expect(
        calculatePersonalOperatingCashFlowLessPpePurchases(
          "0.000000000000000001",
          "0.000000000000000002",
        ),
      ).toEqual({ status: "available", value: "-0.000000000000000001" });
      expect(
        resolvePersonalSecAnnualCashGeneration(
          input(
            [{ ...row(1), value: "0.000000000000000001" }],
            [{ ...row(2, true), value: "0" }],
          ),
        ).operatingCashFlowLessPpePurchases,
      ).toMatchObject({ value: "0.000000000000000001" });
    } finally {
      Decimal.set(before);
    }
  });

  it.each(["", "01", "1e3", "NaN", "Infinity", " 1", "+1", "9".repeat(65)])(
    "rejects malformed or unbounded decimal %s",
    (value) => {
      expect(() =>
        calculatePersonalOperatingCashFlowLessPpePurchases(value, "0"),
      ).toThrow(TypeError);
      expect(() =>
        calculatePersonalOperatingCashFlowLessPpePurchases("1", value),
      ).toThrow(TypeError);
    },
  );
});

function comparativeRows(purchases = false, count = 3): Row[] {
  return Array.from({ length: count }, (_, index) => {
    const year = 2025 - index;
    return {
      ...row(index + (purchases ? 21 : 11), purchases),
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      durationDays: year === 2024 ? 366 : 365,
      value: String((purchases ? 30 : 100) - index * 10),
      sourceLocator: `/facts/us-gaap/${purchases ? "PaymentsToAcquirePropertyPlantAndEquipment" : "NetCashProvidedByUsedInOperatingActivities"}/units/USD/${index}`,
    };
  });
}

function historyInput(count = 3) {
  return input(comparativeRows(false, count), comparativeRows(true, count));
}

function availableHistory(packet: Input) {
  const result = resolvePersonalSecAnnualCashHistory(packet);
  if (result.status !== "available")
    throw new Error(`History refused: ${result.reason}`);
  return result;
}

describe("Reported annual cash history", () => {
  it.each([1, 2, 3, 4])(
    "keeps at most three adjacent periods from %s supplied years",
    (count) => {
      const packet = historyInput(count);
      const before = structuredClone(packet);
      const currentBefore = resolvePersonalSecAnnualCashGeneration(packet);
      const history = availableHistory(packet);
      expect(history.periods).toHaveLength(Math.min(count, 3));
      expect(history.accessionNumber).toBe(accession);
      expect(history.periods[0]).toEqual({
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        operatingCashFlow: "100",
        ppePurchases: "30",
        operatingCashFlowLessPpePurchases: "70",
        observationIds: [
          comparativeRows()[0]!.id,
          comparativeRows(true)[0]!.id,
        ],
      });
      if (count >= 3)
        expect(history.periods[2]).toMatchObject({
          startDate: "2023-01-01",
          endDate: "2023-12-31",
          operatingCashFlow: "80",
          ppePurchases: "10",
          operatingCashFlowLessPpePurchases: "70",
        });
      expect(history.stoppedReason).toBe(count < 3 ? "no_report_period" : null);
      expect(
        history.periods.every(
          (period) => !Object.hasOwn(period, "currentUseEligible"),
        ),
      ).toBe(true);
      expect(Object.isFrozen(history)).toBe(true);
      expect(Object.isFrozen(history.periods)).toBe(true);
      expect(Object.isFrozen(history.periods[0])).toBe(true);
      expect(Object.isFrozen(history.periods[0]!.observationIds)).toBe(true);
      expect(packet).toEqual(before);
      expect(Object.isFrozen(packet)).toBe(false);
      expect(
        Object.isFrozen(packet.cashGeneration.operatingCashFlow.observations),
      ).toBe(false);
      expect(resolvePersonalSecAnnualCashGeneration(packet)).toEqual(
        currentBefore,
      );
    },
  );

  it("does not skip a missing immediately prior year to use an older one", () => {
    const history = availableHistory(
      input(
        comparativeRows().filter((_, index) => index !== 1),
        comparativeRows(true),
      ),
    );
    expect(history.periods).toHaveLength(1);
    expect(history.stoppedReason).toBe("no_report_period");
  });

  it("preserves two admitted periods when the third purchases amount is absent", () => {
    const history = availableHistory(
      input(comparativeRows(), comparativeRows(true, 2)),
    );
    expect(history.periods).toHaveLength(2);
    expect(history.stoppedReason).toBe("no_report_period");
  });

  it("accepts adjacent 53-week fiscal years without replacing the filing report date", () => {
    const rows = (purchases: boolean) =>
      comparativeRows(purchases, 2).map((source, index) => ({
        ...source,
        startDate: index === 0 ? "2024-12-29" : "2023-12-24",
        endDate: index === 0 ? "2025-12-27" : "2024-12-28",
        durationDays: index === 0 ? 364 : 371,
        filing: { ...source.filing, reportDate: "2025-12-27" },
      }));
    const packet = input(rows(false), rows(true));
    packet.target.reportDate = "2025-12-27";
    const original = structuredClone(packet);
    expect(
      availableHistory(packet).periods.map((period) => period.startDate),
    ).toEqual(["2024-12-29", "2023-12-24"]);
    expect(packet).toEqual(original);
  });

  it("uses exact decimal equality and retains all agreeing comparative references", () => {
    const operating = comparativeRows();
    operating[1] = {
      ...operating[1]!,
      value: "123456789012345678901234567890123456789012345678901234567890",
    };
    // Equivalent representation stays within the 64-character source bound.
    const equivalent = {
      ...operating[1],
      id: row(50).id,
      value: `${operating[1].value}.00`,
    };
    const purchases = comparativeRows(true);
    purchases[1] = { ...purchases[1]!, value: "0.000000000000000001" };
    const history = availableHistory(
      input([...operating, equivalent], purchases),
    );
    expect(history.periods[1]).toMatchObject({
      operatingCashFlow: operating[1].value,
      operatingCashFlowLessPpePurchases:
        "123456789012345678901234567890123456789012345678901234567889.999999999999999999",
      observationIds: [operating[1].id, equivalent.id, purchases[1].id],
    });
  });

  it("keeps negative operating flow, zero purchases and negative calculated cash", () => {
    const operating = comparativeRows();
    operating[1] = { ...operating[1]!, value: "-7.25" };
    const purchases = comparativeRows(true);
    purchases[1] = { ...purchases[1]!, value: "0" };
    expect(
      availableHistory(input(operating, purchases)).periods[1],
    ).toMatchObject({
      operatingCashFlow: "-7.25",
      ppePurchases: "0",
      operatingCashFlowLessPpePurchases: "-7.25",
    });
  });

  it.each([
    [{ durationDays: 334 }, "invalid_annual_period"],
    [{ durationDays: 396 }, "invalid_annual_period"],
    [{ durationDays: 365 }, "invalid_annual_period"],
    [{ startDate: null }, "invalid_annual_period"],
    [{ filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ filedDate: "2026-02-02" }, "filing_unmatched_or_conflicted"],
    [
      { filing: { ...row(1).filing, status: "metadata_conflict" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...row(1).filing, acceptedAt: "2026-02-01T17:00:00.000Z" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...row(1).filing, sourceUrl: "https://www.sec.gov/other" } },
      "filing_unmatched_or_conflicted",
    ],
    [
      { filing: { ...row(1).filing, reportDate: "2024-12-31" } },
      "report_end_mismatch",
    ],
  ] satisfies readonly (readonly [
    Partial<Row>,
    PersonalSecAnnualCashHistoryReason,
  ])[])(
    "stops at invalid prior metadata %j without changing current cash",
    (change, reason) => {
      const operating = comparativeRows();
      operating[1] = { ...operating[1]!, ...change };
      const packet = input(operating, comparativeRows(true));
      const current = resolvePersonalSecAnnualCashGeneration(packet);
      const history = availableHistory(packet);
      expect(history.periods).toHaveLength(1);
      expect(history.stoppedReason).toBe(reason);
      expect(resolvePersonalSecAnnualCashGeneration(packet)).toEqual(current);
    },
  );

  it("does not filter away an invalid prior row to choose an annual alternative", () => {
    const operating = comparativeRows();
    const extra = { ...operating[1]!, id: row(60).id, durationDays: 90 };
    const history = availableHistory(
      input([...operating, extra], comparativeRows(true)),
    );
    expect(history.periods).toHaveLength(1);
    expect(history.stoppedReason).toBe("invalid_annual_period");
  });

  it.each(["value", "start"] as const)(
    "refuses conflicting prior %s",
    (kind) => {
      const operating = comparativeRows();
      const extra = {
        ...operating[1]!,
        id: row(60).id,
        ...(kind === "value"
          ? { value: "91" }
          : { startDate: "2024-01-02", durationDays: 365 }),
      };
      const history = availableHistory(
        input([...operating, extra], comparativeRows(true)),
      );
      expect(history.periods).toHaveLength(1);
      expect(history.stoppedReason).toBe(
        kind === "value" ? "ambiguous_value" : "ambiguous_period",
      );
    },
  );

  it("refuses differing prior cash periods even when each operand is annual", () => {
    const purchases = comparativeRows(true);
    purchases[1] = {
      ...purchases[1]!,
      startDate: "2024-01-02",
      durationDays: 365,
    };
    const history = availableHistory(input(comparativeRows(), purchases));
    expect(history.periods).toHaveLength(1);
    expect(history.stoppedReason).toBe("period_mismatch");
  });

  it("does not choose negative purchases as a positive subtraction input", () => {
    const purchases = comparativeRows(true);
    purchases[1] = { ...purchases[1]!, value: "-1" };
    const history = availableHistory(input(comparativeRows(), purchases));
    expect(history.periods).toHaveLength(1);
    expect(history.stoppedReason).toBe("unsupported_sign");
  });

  it("rejects another accession rather than treating it as a fallback", () => {
    const operating = comparativeRows();
    operating[1] = {
      ...operating[1]!,
      accessionNumber: "0000999999-25-000001",
    };
    expect(() =>
      resolvePersonalSecAnnualCashHistory(
        input(operating, comparativeRows(true)),
      ),
    ).toThrow(TypeError);
  });

  it("withholds history for an old selected report while retaining its current historical amounts", () => {
    const packet = historyInput();
    const shifted = JSON.parse(
      JSON.stringify(packet).replaceAll("2026-09-20", "2027-09-20"),
    ) as Input;
    expect(resolvePersonalSecAnnualCashHistory(shifted)).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
    expect(
      resolvePersonalSecAnnualCashGeneration(shifted).operatingCashFlow,
    ).toMatchObject({
      status: "available",
      value: "100",
      currentUseEligible: false,
    });
  });

  it("requires the current cash pair independently of any income basis", () => {
    const packet = historyInput();
    packet.cashGeneration.ppePurchases = metric([], "concept_missing");
    expect(resolvePersonalSecAnnualCashHistory(packet)).toEqual({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(
      resolvePersonalSecAnnualCashGeneration(packet).operatingCashFlow.status,
    ).toBe("available");
    expect(availableHistory(historyInput()).periods).toHaveLength(3);
  });

  it("preserves independent scan refusals and rejects malformed coverage", () => {
    const packet = historyInput();
    packet.cashGeneration.ppePurchases = {
      scan: { status: "candidate_limit", absence: null, coverage: null },
      observations: [],
    };
    expect(resolvePersonalSecAnnualCashHistory(packet)).toEqual({
      status: "unavailable",
      reason: "candidate_limit",
    });
    const invalid = historyInput();
    const scan = invalid.cashGeneration.operatingCashFlow.scan;
    if (scan.status !== "available") throw new Error("Fixture scan");
    invalid.cashGeneration.operatingCashFlow = {
      ...invalid.cashGeneration.operatingCashFlow,
      scan: {
        ...scan,
        coverage: {
          ...scan.coverage,
          full: { ...scan.coverage.full, candidateRows: 4 },
        },
      },
    };
    expect(() => resolvePersonalSecAnnualCashHistory(invalid)).toThrow(
      TypeError,
    );
  });
});

describe("Reported cash history context boundaries", () => {
  it("retains source-clock refusal before any comparative calculation", () => {
    const packet = historyInput();
    packet.generation.completedAt = "invalid";
    expect(resolvePersonalSecAnnualCashHistory(packet)).toEqual({
      status: "unavailable",
      reason: "invalid_clock",
    });
  });

  it("withholds a complete selected metric over its independent 100-row bound", () => {
    const packet = historyInput();
    packet.cashGeneration.operatingCashFlow = {
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
    };
    expect(resolvePersonalSecAnnualCashHistory(packet)).toEqual({
      status: "unavailable",
      reason: "selected_report_overflow",
    });
    expect(
      resolvePersonalSecAnnualCashGeneration(packet).ppePurchases.status,
    ).toBe("available");
  });

  it("refuses counted invalid rows rather than presenting the retained valid subset as complete", () => {
    const packet = historyInput();
    const original = packet.cashGeneration.operatingCashFlow;
    const scan = original.scan;
    if (scan.status !== "available") throw new Error("Fixture scan");
    packet.cashGeneration.operatingCashFlow = {
      ...original,
      scan: {
        ...scan,
        coverage: {
          ...scan.coverage,
          full: {
            ...scan.coverage.full,
            candidateRows: 4,
            inspectedRows: 4,
            invalidRows: 1,
          },
        },
      },
    };
    expect(resolvePersonalSecAnnualCashHistory(packet)).toEqual({
      status: "unavailable",
      reason: "invalid_source_rows",
    });
  });
});
