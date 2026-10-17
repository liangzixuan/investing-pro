import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualCanonicalCashGeneration as resolve,
  resolvePersonalSecAnnualCanonicalCashHistory as history,
} from "./personal-sec-annual-canonical-cash";
import {
  resolvePersonalSecAnnualCashCore,
  resolvePersonalSecAnnualCashHistoryCore,
  type PersonalSecAnnualCashCoreInput,
} from "./personal-sec-annual-cash-core";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";
import {
  fixture,
  observation,
  setScan,
} from "./personal-sec-annual-statements.fixture";

const ocf = "NetCashProvidedByUsedInOperatingActivities";
const ppe = "PaymentsToAcquirePropertyPlantAndEquipment";
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
function rows(count = 3): PersonalSecAnnualStatementObservationDto[] {
  return ([ocf, ppe] as const).flatMap((concept) =>
    Array.from({ length: count }, (_, index) => {
      const year = 2025 - index;
      return observation(concept, index, {
        startDate: `${year - 1}-10-01`,
        endDate: `${year}-09-30`,
        filingFocusYear: year,
        value: String((concept === ocf ? 100 : 30) - index * 10),
      });
    }),
  );
}
function coreInput(): Mutable<PersonalSecAnnualCashCoreInput> {
  const canonical = fixture(rows());
  const inputs = derivePersonalSecAnnualFinancialInputs(canonical);
  return structuredClone({
    cik: canonical.cik,
    generation: {
      cutoffAt: canonical.generation.cutoffAt,
      completedAt: canonical.generation.completedAt,
      sources: canonical.generation.sources,
    },
    target: canonical.target,
    cashGeneration: inputs.cashGeneration,
  }) as Mutable<PersonalSecAnnualCashCoreInput>;
}

describe("canonical v6 annual cash calculations", () => {
  it("uses exact original source rows and signed unsafe decimals without metric tags or a generation rewrite", () => {
    const input = fixture([
      observation(ocf, 0, { value: "-9007199254740993.125" }),
      observation(ppe, 0, { value: "0.000000000000000001" }),
    ]);
    const before = structuredClone(input);
    const result = resolve(input);
    expect(result.operatingCashFlow).toMatchObject({
      status: "available",
      value: "-9007199254740993.125",
      currentUseEligible: true,
    });
    expect(result.ppePurchases).toMatchObject({
      status: "available",
      value: "0.000000000000000001",
    });
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "-9007199254740993.125000000000000001",
      observationIds: input.facts.observations.map((row) => row.id),
    });
    expect(result.utilityAge).toMatchObject({
      endAgeDays: 125,
      withinWindow: true,
    });
    expect(input).toEqual(before);
    expect(input.generation.definitionVersion).toBe("6.0.0");
    expect(
      input.facts.observations.every((row) => !Object.hasOwn(row, "metric")),
    ).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.facts.observations[0])).toBe(false);
    expect(
      Object.isFrozen(result.operatingCashFlowLessPpePurchases.observationIds),
    ).toBe(true);
  });
  it("uses the same kernel from an input whose generation has no protocol field", () => {
    const input = coreInput();
    expect(Object.hasOwn(input.generation, "definitionVersion")).toBe(false);
    expect(
      resolvePersonalSecAnnualCashCore(input).operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "70" });
    expect(resolvePersonalSecAnnualCashHistoryCore(input).status).toBe(
      "available",
    );
  });
  it("keeps cash independent of missing, failed or over-limit effective income", () => {
    for (const mode of ["missing", "failed", "overflow"]) {
      const input = fixture(rows());
      if (mode === "failed")
        setScan(input, "NetIncomeLoss", {
          status: "invalid_response",
          absence: null,
          coverage: null,
        });
      if (mode === "overflow")
        setScan(input, "NetIncomeLoss", {
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
        });
      expect(resolve(input).operatingCashFlowLessPpePurchases).toMatchObject({
        status: "available",
        value: "70",
      });
      const result = history(input);
      expect(result.status).toBe("available");
      if (result.status === "available") expect(result.periods).toHaveLength(3);
    }
  });
  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "keeps OCF when purchases are %s",
    (absence) => {
      const input = fixture([observation(ocf)]);
      const scan = input.facts.scans.find((s) => s.concept === ppe)!.scan;
      if (scan.status !== "available") throw Error();
      scan.absence = absence;
      const result = resolve(input);
      expect(result.operatingCashFlow.status).toBe("available");
      expect(result.ppePurchases).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
        reason: absence,
      });
      expect(history(input)).toEqual({
        status: "unavailable",
        reason: absence,
      });
    },
  );
  it.each(["invalid_response", "candidate_limit"] as const)(
    "isolates a %s cash scan",
    (status) => {
      const input = fixture([observation(ppe)]);
      setScan(input, ocf, { status, absence: null, coverage: null });
      const result = resolve(input);
      expect(result.operatingCashFlow).toMatchObject({ reason: status });
      expect(result.ppePurchases.status).toBe("available");
      expect(history(input)).toEqual({ status: "unavailable", reason: status });
    },
  );
  it("keeps retained valid OCF references when counted invalid rows withhold that concept", () => {
    const input = fixture([observation(ocf), observation(ppe)]);
    const scan = input.facts.scans.find((s) => s.concept === ocf)!.scan;
    if (scan.status !== "available") throw Error();
    scan.coverage.full.candidateRows++;
    scan.coverage.full.inspectedRows++;
    scan.coverage.full.invalidRows++;
    const result = resolve(input);
    expect(result.operatingCashFlow).toEqual({
      status: "unavailable",
      reason: "invalid_source_rows",
      observationIds: [
        input.facts.observations.find((r) => r.concept === ocf)!.id,
      ],
    });
    expect(result.ppePurchases.status).toBe("available");
  });
  it("refuses selected OCF overflow without consuming the purchases allowance", () => {
    const input = fixture([observation(ppe)]);
    setScan(input, ocf, {
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
    });
    const result = resolve(input);
    expect(result.operatingCashFlow).toMatchObject({
      reason: "selected_report_overflow",
      observationIds: [],
    });
    expect(result.ppePurchases.status).toBe("available");
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "selected_report_overflow",
    });
  });
  it("retains a negative purchases report but refuses subtraction and history", () => {
    const input = fixture([
      observation(ocf, 0, { value: "-5" }),
      observation(ppe, 0, { value: "-2" }),
    ]);
    const result = resolve(input);
    expect(result.operatingCashFlow).toMatchObject({
      status: "available",
      value: "-5",
    });
    expect(result.ppePurchases).toMatchObject({
      status: "available",
      value: "-2",
    });
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      reason: "unsupported_sign",
    });
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "unsupported_sign",
    });
  });
  it("keeps zero purchases and signed negative calculated cash", () => {
    const input = fixture([
      observation(ocf, 0, { value: "-7.25" }),
      observation(ppe, 0, { value: "0" }),
    ]);
    expect(resolve(input).operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "-7.25",
    });
  });
  it("refuses current same-end value or start conflicts rather than choosing a row", () => {
    for (const change of [{ value: "2" }, { startDate: "2024-09-30" }]) {
      const input = fixture([
        observation(ocf),
        observation(ocf, 1, change),
        observation(ppe),
      ]);
      expect(resolve(input).operatingCashFlow).toMatchObject({
        reason: "value" in change ? "ambiguous_value" : "ambiguous_period",
      });
    }
  });
  it("keeps independently valid annual amounts but refuses their different periods", () => {
    const input = fixture([
      observation(ocf),
      observation(ppe, 0, { startDate: "2024-09-30" }),
    ]);
    const result = resolve(input);
    expect(result.operatingCashFlow.status).toBe("available");
    expect(result.ppePurchases.status).toBe("available");
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      reason: "period_mismatch",
    });
  });
  it("retains current historical values while withholding current-use history", () => {
    const input = fixture(rows());
    const time = "2027-02-02T06:00:00.000Z";
    input.generation.cutoffAt = time;
    input.generation.completedAt = time;
    input.generation.sources.companyFacts.fetchedAt = time;
    input.generation.sources.submissions.fetchedAt = time;
    const result = resolve(input);
    expect(result.operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "70",
      currentUseEligible: false,
    });
    expect(result.utilityAge!.withinWindow).toBe(false);
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
    });
  });
  it.each(["invalid_clock", "source_stale"] as const)(
    "preserves %s before any comparative calculation",
    (reason) => {
      const input = fixture(rows());
      if (reason === "invalid_clock")
        input.generation.completedAt = "2026-02-02T05:00:00.000Z";
      else input.generation.completedAt = "2026-02-10T06:00:00.000Z";
      expect(resolve(input).operatingCashFlow).toMatchObject({ reason });
      expect(resolve(input).ppePurchases).toMatchObject({ reason });
      expect(history(input)).toEqual({ status: "unavailable", reason });
    },
  );
  it("keeps an unresolved target explicit", () => {
    const input = fixture();
    input.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    for (const item of input.facts.scans)
      if (item.scan.status === "available")
        Object.assign(item.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    expect(resolve(input).operatingCashFlow).toMatchObject({
      reason: "target_unresolved",
    });
    expect(resolve(input).utilityAge).toBeNull();
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "target_unresolved",
    });
  });
  it("keeps a shared source failure explicit", () => {
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
    expect(resolve(input).operatingCashFlow).toMatchObject({
      reason: "source_unavailable",
    });
    expect(history(input)).toEqual({
      status: "unavailable",
      reason: "source_unavailable",
    });
  });
  it("stays independent of global Decimal precision and rounding", () => {
    const precision = Decimal.precision,
      rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      const input = fixture([
        observation(ocf, 0, { value: "9007199254740993.125" }),
        observation(ppe, 0, { value: "0.000000000000000001" }),
      ]);
      expect(resolve(input).operatingCashFlowLessPpePurchases).toMatchObject({
        value: "9007199254740993.124999999999999999",
      });
    } finally {
      Decimal.set({ precision, rounding });
    }
  });
});

describe("canonical same-filing cash history", () => {
  it.each([1, 2, 3, 4])(
    "retains at most three adjacent annual periods from %i supplied",
    (count) => {
      const input = fixture(rows(count));
      const before = structuredClone(input);
      const result = history(input);
      expect(result.status).toBe("available");
      if (result.status !== "available") throw Error();
      expect(result.periods).toHaveLength(Math.min(3, count));
      expect(result.periods[0]).toMatchObject({
        startDate: "2024-10-01",
        endDate: "2025-09-30",
        operatingCashFlow: "100",
        ppePurchases: "30",
        operatingCashFlowLessPpePurchases: "70",
      });
      expect(result.stoppedReason).toBe(count < 3 ? "no_report_period" : null);
      expect(
        result.periods.every((p) => !Object.hasOwn(p, "currentUseEligible")),
      ).toBe(true);
      expect(Object.isFrozen(result.periods[0]!.observationIds)).toBe(true);
      expect(input).toEqual(before);
    },
  );
  it("does not fill a gap with an older annual period", () => {
    const input = fixture(
      rows().filter(
        (row) => !(row.concept === ocf && row.endDate === "2024-09-30"),
      ),
    );
    const result = history(input);
    expect(result).toMatchObject({
      status: "available",
      stoppedReason: "no_report_period",
    });
    if (result.status !== "available") throw Error();
    expect(result.periods).toHaveLength(1);
  });
  it("uses full selected rows and contiguous starts rather than the statement-table axes", () => {
    const input = fixture([
      ...rows(),
      observation(ocf, 3, {
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        value: "500",
      }),
      observation(ppe, 3, {
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        value: "1",
      }),
    ]);
    const statements = resolvePersonalSecAnnualStatements(input);
    expect(
      statements.statements
        .find((s) => s.id === "cash_flow")!
        .columns.map((c) => c.endDate),
    ).toEqual(["2025-09-30", "2025-03-31", "2024-09-30"]);
    const result = history(input);
    if (result.status !== "available") throw Error();
    expect(result.periods.map((p) => p.endDate)).toEqual([
      "2025-09-30",
      "2024-09-30",
      "2023-09-30",
    ]);
    expect(
      result.periods.every((p) => p.operatingCashFlowLessPpePurchases === "70"),
    ).toBe(true);
  });
  it("retains adjacent 53-week fiscal periods with original filing joins", () => {
    const input = fixture(
      ([ocf, ppe] as const).flatMap((concept) => [
        observation(concept, 0, {
          startDate: "2024-12-29",
          endDate: "2025-12-27",
          value: concept === ocf ? "100" : "30",
        }),
        observation(concept, 1, {
          startDate: "2023-12-24",
          endDate: "2024-12-28",
          value: concept === ocf ? "90" : "20",
        }),
      ]),
    );
    if (input.target.status !== "target") throw Error();
    input.target.reportDate = "2025-12-27";
    for (const row of input.facts.observations)
      row.filing.reportDate = "2025-12-27";
    const result = history(input);
    if (result.status !== "available") throw Error();
    expect(result.periods.map((p) => p.startDate)).toEqual([
      "2024-12-29",
      "2023-12-24",
    ]);
    expect(
      input.facts.observations.find((r) => r.endDate === "2024-12-28")!
        .durationDays,
    ).toBe(371);
    expect(
      input.facts.observations.every(
        (r) => r.filing.reportDate === "2025-12-27",
      ),
    ).toBe(true);
  });
  it("does not filter away a quarterly row to choose an annual alternative at the required prior end", () => {
    const input = fixture([
      ...rows(),
      observation(ocf, 3, {
        startDate: "2024-07-01",
        endDate: "2024-09-30",
        value: "9",
      }),
    ]);
    const result = history(input);
    expect(result).toMatchObject({
      status: "available",
      stoppedReason: "invalid_annual_period",
    });
    if (result.status !== "available") throw Error();
    expect(result.periods).toHaveLength(1);
    expect(resolve(input).operatingCashFlow.status).toBe("available");
  });
  it("stops at a conflicted prior value without changing the current calculation", () => {
    const input = fixture([
      ...rows(),
      observation(ocf, 3, {
        startDate: "2023-10-01",
        endDate: "2024-09-30",
        value: "999",
      }),
    ]);
    expect(history(input)).toMatchObject({
      status: "available",
      stoppedReason: "ambiguous_value",
    });
    expect(resolve(input).operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "70",
    });
  });
  it("rejects another accession instead of filling a gap", () => {
    const input = fixture([
      ...rows(),
      observation(ocf, 4, { accessionNumber: "0000999999-25-000001" }),
    ]);
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => history(input)).toThrow(TypeError);
  });
});

describe("cash core admission independent of wire wrappers", () => {
  it.each([
    [
      "decimal",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        v.cashGeneration.operatingCashFlow.observations[0]!.value = "NaN";
      },
    ],
    [
      "oversized decimal",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        v.cashGeneration.operatingCashFlow.observations[0]!.value = "1".repeat(
          65,
        );
      },
    ],
    [
      "concept",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        v.cashGeneration.operatingCashFlow.observations[0]!.concept = ppe;
      },
    ],
    [
      "ID",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        Object.assign(v.cashGeneration.operatingCashFlow.observations[0]!, {
          id: "sec-fact:bad",
        });
      },
    ],
    [
      "duplicate ID across concepts",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        v.cashGeneration.ppePurchases.observations[0]!.id =
          v.cashGeneration.operatingCashFlow.observations[0]!.id;
      },
    ],
    [
      "old accession",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        v.cashGeneration.operatingCashFlow.observations[0]!.accessionNumber =
          "0000999999-25-000001";
      },
    ],
    [
      "coverage arithmetic",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        const s = v.cashGeneration.operatingCashFlow.scan;
        if (s.status !== "available") throw Error();
        s.coverage.full.candidateRows++;
      },
    ],
    [
      "returned counts",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        const s = v.cashGeneration.operatingCashFlow.scan;
        if (s.status !== "available") throw Error();
        s.coverage.returned = 0;
      },
    ],
    [
      "unbounded candidates",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        const s = v.cashGeneration.operatingCashFlow.scan;
        if (s.status !== "available") throw Error();
        s.coverage.full.candidateRows = 10001;
        s.coverage.full.inspectedRows = 10001;
        s.coverage.full.duplicateRows = 9998;
      },
    ],
    [
      "unknown status",
      (v: Mutable<PersonalSecAnnualCashCoreInput>): void => {
        Object.assign(v.cashGeneration.operatingCashFlow.scan, {
          status: "other",
        });
      },
    ],
  ] as const)(
    "rejects malformed %s even without canonical admission",
    (_label, mutate) => {
      const input = coreInput();
      mutate(input);
      expect(() => resolvePersonalSecAnnualCashCore(input)).toThrow(TypeError);
      expect(() => resolvePersonalSecAnnualCashHistoryCore(input)).toThrow(
        TypeError,
      );
    },
  );
  it("independently applies shared clock and filing policy", () => {
    const input = coreInput();
    input.generation.completedAt = "invalid";
    expect(
      resolvePersonalSecAnnualCashCore(input).operatingCashFlow,
    ).toMatchObject({ reason: "invalid_clock" });
    const filing = coreInput();
    if (filing.target.status !== "target") throw Error();
    filing.target.filedDate = "2026-02-03";
    expect(
      resolvePersonalSecAnnualCashCore(filing).operatingCashFlow,
    ).toMatchObject({ reason: "future_or_inconsistent_dates" });
  });
  it("independently refuses substituted filing coordinates and invalid annual rows", () => {
    const input = coreInput();
    input.cashGeneration.operatingCashFlow.observations[0]!.filing.sourceUrl =
      "https://www.sec.gov/other";
    expect(
      resolvePersonalSecAnnualCashCore(input).operatingCashFlow,
    ).toMatchObject({ reason: "filing_unmatched_or_conflicted" });
    const period = coreInput();
    period.cashGeneration.operatingCashFlow.observations[0]!.durationDays = 92;
    expect(
      resolvePersonalSecAnnualCashCore(period).operatingCashFlow,
    ).toMatchObject({ reason: "invalid_annual_period" });
  });
  it("the canonical wrapper refuses another definition instead of accepting a fallback", () => {
    const input = fixture(rows());
    Object.assign(input.generation, { definitionVersion: "5.0.0" });
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => history(input)).toThrow(TypeError);
  });
});
