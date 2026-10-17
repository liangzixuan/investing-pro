import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualRevenueConcept,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualCanonicalOperatingResults as resolve,
  resolvePersonalSecAnnualCanonicalOperatingHistory as history,
  comparePersonalSecAnnualCanonicalOperatingEvidence as compare,
} from "./personal-sec-annual-canonical-operating";
import { resolvePersonalSecAnnualCanonicalIncome } from "./personal-sec-annual-canonical-income";
import { derivePersonalSecAnnualFinancialInputs } from "./personal-sec-annual-financial-inputs";
import { resolvePersonalSecAnnualStatements } from "./personal-sec-annual-statements";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";

const starts = ["2024-10-01", "2023-10-01", "2022-10-01"];
const ends = ["2025-09-30", "2024-09-30", "2023-09-30"];
function flow(
  concept: PersonalSecAnnualStatementConcept,
  index = 0,
  value = concept === "OperatingIncomeLoss" ? "15" : "100",
  changes: Partial<PersonalSecAnnualStatementObservationDto> = {},
) {
  return observation(concept, index, {
    startDate: starts[index] ?? starts[0]!,
    endDate: ends[index] ?? ends[0]!,
    value,
    ...changes,
  });
}
function packet(rows = [flow("OperatingIncomeLoss"), flow("Revenues")]) {
  return fixture(rows);
}
function historyPacket() {
  return packet([
    ...["15", "10", "5"].map((value, index) =>
      flow("OperatingIncomeLoss", index, value),
    ),
    ...["100", "80", "60"].map((value, index) =>
      flow("Revenues", index, value),
    ),
  ]);
}
function basis(
  input: Fixture,
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  return resolve(input).margins.find((row) => row.concept === concept)!;
}
function availableHistory(
  input: Fixture,
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  const result = history(input, concept);
  if (result.status !== "available")
    throw new Error(`Expected history, got ${result.reason}.`);
  return result;
}
function failedScan(
  input: Fixture,
  concept: PersonalSecAnnualStatementConcept,
  kind: "invalid_response" | "candidate_limit" | "invalid_rows" | "overflow",
) {
  if (kind === "invalid_response" || kind === "candidate_limit") {
    setScan(input, concept, { status: kind, absence: null, coverage: null });
    return;
  }
  const overflow = kind === "overflow";
  setScan(input, concept, {
    status: "available",
    absence: null,
    coverage: {
      full: {
        candidateRows: overflow ? 101 : 1,
        inspectedRows: overflow ? 101 : 1,
        invalidRows: overflow ? 0 : 1,
        duplicateRows: 0,
        uniqueObservations: overflow ? 101 : 0,
      },
      selected: overflow ? 101 : 0,
      otherAccessions: 0,
      returned: 0,
      omittedSelected: overflow ? 101 : 0,
    },
  });
}

describe("canonical annual operating results", () => {
  it("uses original v6 rows and scans, keeps all three revenue bases independent and leaves the caller graph unchanged", () => {
    const input = packet([
      flow("OperatingIncomeLoss", 0, "-9007199254740993.125"),
      ...PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept, index) =>
        flow(concept, 0, String(100 * (index + 1))),
      ),
    ]);
    const before = structuredClone(input);
    const projected = derivePersonalSecAnnualFinancialInputs(input);
    const source = input.facts.observations.find(
      (row) => row.concept === "OperatingIncomeLoss",
    )!;
    expect(projected.operatingResults.operatingIncome.observations[0]).toBe(
      source,
    );
    expect(projected.operatingResults.operatingIncome.scan).toBe(
      input.facts.scans.find(
        (entry) => entry.concept === "OperatingIncomeLoss",
      )!.scan,
    );
    const result = resolve(input);
    expect(result.operatingIncome).toMatchObject({
      status: "available",
      value: "-9007199254740993.125",
      observationIds: [source.id],
      currentUseEligible: true,
    });
    expect(result.margins.map((row) => row.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
    );
    expect(result.margins.map((row) => row.operatingMargin)).toMatchObject([
      { status: "available", value: "-9007199254740993.13" },
      { status: "available", value: "-4503599627370496.56" },
      { status: "available", value: "-3002399751580331.04" },
    ]);
    expect(input).toEqual(before);
    expect(input.generation.definitionVersion).toBe("6.0.0");
    expect(input.facts.observations.every((row) => !("metric" in row))).toBe(
      true,
    );
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(source)).toBe(false);
    expect(
      Object.isFrozen(result.margins[0]!.operatingMargin.observationIds),
    ).toBe(true);
  });

  it("uses exact revenue without borrowing net-income annual-period eligibility", () => {
    const input = packet([
      flow("OperatingIncomeLoss"),
      flow("Revenues"),
      observation("NetIncomeLoss", 0, { startDate: null, durationDays: null }),
    ]);
    expect(
      resolvePersonalSecAnnualCanonicalIncome(input).selectedReportPairEligible,
    ).toBe(false);
    expect(basis(input).operatingMargin).toMatchObject({
      status: "available",
      value: "15",
    });
    expect(resolve(input).operatingIncome).toMatchObject({
      status: "available",
      value: "15",
    });
  });

  it.each([
    "invalid_response",
    "candidate_limit",
    "invalid_rows",
    "overflow",
  ] as const)(
    "keeps the operating amount when effective income is refused for %s",
    (kind) => {
      const input = packet();
      failedScan(input, "NetIncomeLoss", kind);
      const expected =
        kind === "invalid_rows"
          ? "invalid_source_rows"
          : kind === "overflow"
            ? "selected_report_overflow"
            : kind;
      expect(resolve(input).operatingIncome).toMatchObject({
        status: "available",
        value: "15",
      });
      expect(basis(input).revenue).toMatchObject({
        status: "unavailable",
        reason: expected,
      });
      expect(basis(input).operatingMargin).toMatchObject({
        status: "unavailable",
        reason: expected,
      });
      expect(history(input, "Revenues")).toEqual({
        status: "unavailable",
        reason: expected,
      });
      expect(compare(input, "Revenues")).toEqual({
        status: "unavailable",
        stage: "current_pair",
        reason: expected,
      });
      expect(
        input.facts.observations.find((row) => row.concept === "Revenues")!
          .value,
      ).toBe("100");
    },
  );

  it.each([
    "invalid_response",
    "candidate_limit",
    "invalid_rows",
    "overflow",
  ] as const)(
    "keeps admitted revenue when operating scan is refused for %s",
    (kind) => {
      const input = packet([flow("Revenues")]);
      failedScan(input, "OperatingIncomeLoss", kind);
      const expected =
        kind === "invalid_rows"
          ? "invalid_source_rows"
          : kind === "overflow"
            ? "selected_report_overflow"
            : kind;
      expect(resolve(input).operatingIncome).toMatchObject({
        status: "unavailable",
        reason: expected,
      });
      expect(basis(input).revenue).toMatchObject({
        status: "available",
        value: "100",
      });
      expect(basis(input).operatingMargin).toMatchObject({
        status: "unavailable",
        reason: expected,
      });
      expect(history(input, "Revenues")).toEqual({
        status: "unavailable",
        reason: expected,
      });
    },
  );

  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "retains exact operating absence %s",
    (absence) => {
      const input = packet([flow("Revenues")]);
      setScan(input, "OperatingIncomeLoss", {
        status: "available",
        absence,
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
      });
      expect(resolve(input).operatingIncome).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(basis(input).revenue).toMatchObject({ status: "available" });
    },
  );

  it.each([
    ["0", "100", "0"],
    ["-0.00001", "100", "0"],
    ["-1", "32", "-3.13"],
    ["1", "32", "3.13"],
    ["1", "0", "nonpositive_revenue"],
    ["1", "-1", "nonpositive_revenue"],
  ])(
    "keeps signed/zero operands %s/%s and the positive-revenue margin rule",
    (operating, revenue, expected) => {
      const input = packet([
        flow("OperatingIncomeLoss", 0, operating),
        flow("Revenues", 0, revenue),
      ]);
      expect(resolve(input).operatingIncome).toMatchObject({
        status: "available",
        value: operating,
      });
      expect(basis(input).revenue).toMatchObject({
        status: "available",
        value: revenue,
      });
      expect(basis(input).operatingMargin).toMatchObject(
        expected === "nonpositive_revenue"
          ? { status: "unavailable", reason: expected }
          : { status: "available", value: expected },
      );
    },
  );

  it("does not substitute another revenue basis for a missing exact basis", () => {
    const input = packet([
      flow("OperatingIncomeLoss"),
      flow("SalesRevenueNet", 0, "200"),
    ]);
    expect(basis(input, "Revenues").operatingMargin).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(basis(input, "SalesRevenueNet").operatingMargin).toMatchObject({
      status: "available",
      value: "7.5",
    });
    expect(history(input, "Revenues")).toEqual({
      status: "unavailable",
      reason: "no_report_period",
    });
  });

  it("retains all 100 agreeing operating references at the complete 10,000-candidate bound", () => {
    const input = packet([
      ...Array.from({ length: 100 }, (_, index) =>
        flow("OperatingIncomeLoss", index, "15", {
          startDate: starts[0]!,
          endDate: ends[0]!,
        }),
      ),
      flow("Revenues"),
    ]);
    const scan = input.facts.scans.find(
      (entry) => entry.concept === "OperatingIncomeLoss",
    )!.scan;
    if (scan.status !== "available") throw new Error("Expected scan.");
    Object.assign(scan.coverage.full, {
      candidateRows: 10_000,
      inspectedRows: 10_000,
      duplicateRows: 9_900,
    });
    expect(resolve(input).operatingIncome.observationIds).toHaveLength(100);
    expect(basis(input).operatingMargin.observationIds).toHaveLength(101);
    expect(availableHistory(input).periods[0]!.observationIds).toHaveLength(
      101,
    );
  });

  it.each([
    ["focus", "missing_or_non_FY_focus"],
    ["instant", "invalid_annual_period"],
    ["conflict", "filing_unmatched_or_conflicted"],
    ["different start", "period_mismatch"],
    ["two starts", "ambiguous_period"],
    ["two values", "ambiguous_value"],
  ] as const)("keeps annual operating admission for %s", (kind, reason) => {
    const changes: Partial<PersonalSecAnnualStatementObservationDto> = {};
    if (kind === "focus") Object.assign(changes, { filingFocusPeriod: "Q4" });
    if (kind === "instant")
      Object.assign(changes, { startDate: null, durationDays: null });
    if (kind === "different start")
      Object.assign(changes, { startDate: "2024-10-02" });
    const rows = [
      flow("OperatingIncomeLoss", 0, "15", changes),
      flow("Revenues"),
    ];
    if (kind === "two starts")
      rows.push(
        flow("OperatingIncomeLoss", 1, "15", {
          startDate: "2024-10-02",
          endDate: ends[0]!,
        }),
      );
    if (kind === "two values")
      rows.push(
        flow("OperatingIncomeLoss", 1, "16", {
          startDate: starts[0]!,
          endDate: ends[0]!,
        }),
      );
    const input = packet(rows);
    if (kind === "conflict")
      input.facts.observations.find(
        (row) => row.concept === "OperatingIncomeLoss",
      )!.filing.status = "metadata_conflict";
    expect(basis(input).operatingMargin).toMatchObject({
      status: "unavailable",
      reason,
    });
    expect(history(input, "Revenues")).toEqual({
      status: "unavailable",
      reason,
    });
  });

  it.each(["version", "metric", "duplicate ID", "decimal", "count"] as const)(
    "rejects malformed canonical %s",
    (kind) => {
      const input = packet();
      const operating = input.facts.observations.find(
        (row) => row.concept === "OperatingIncomeLoss",
      )!;
      if (kind === "version")
        Object.assign(input.generation, { definitionVersion: "5.0.0" });
      if (kind === "metric")
        Object.assign(operating, { metric: "operating_income" });
      if (kind === "duplicate ID")
        operating.id = input.facts.observations[0]!.id;
      if (kind === "decimal") operating.value = "1e3";
      if (kind === "count") {
        const scan = input.facts.scans.find(
          (entry) => entry.concept === "OperatingIncomeLoss",
        )!.scan;
        if (scan.status === "available") scan.coverage.returned = 0;
      }
      expect(() => resolve(input)).toThrow(TypeError);
      expect(() => history(input, "Revenues")).toThrow(TypeError);
      expect(() => compare(input, "Revenues")).toThrow(TypeError);
    },
  );

  it.each([
    ["2026-02-02T05:59:59.999Z", "invalid_clock"],
    ["2026-02-09T06:00:01.000Z", null],
    ["2026-02-09T06:00:01.001Z", "source_stale"],
  ] as const)(
    "keeps shared source clock policy at %s",
    (completedAt, reason) => {
      const input = historyPacket();
      input.generation.completedAt = completedAt;
      expect(resolve(input).operatingIncome).toMatchObject(
        reason ? { status: "unavailable", reason } : { status: "available" },
      );
      expect(compare(input, "Revenues")).toMatchObject(
        reason
          ? { status: "unavailable", stage: "current_pair", reason }
          : { status: "available" },
      );
    },
  );
});

describe("canonical same-filing operating history and comparison", () => {
  it("retains three contiguous periods and computes exact differences with one shared rounding policy", () => {
    const input = historyPacket();
    const before = JSON.stringify(input);
    expect(availableHistory(input)).toMatchObject({
      status: "available",
      stoppedReason: null,
      periods: [
        {
          startDate: starts[0],
          endDate: ends[0],
          operatingIncome: "15",
          revenue: "100",
          operatingMarginPercent: "15",
        },
        {
          startDate: starts[1],
          endDate: ends[1],
          operatingIncome: "10",
          revenue: "80",
          operatingMarginPercent: "12.5",
        },
        {
          startDate: starts[2],
          endDate: ends[2],
          operatingIncome: "5",
          revenue: "60",
          operatingMarginPercent: "8.33",
        },
      ],
    });
    expect(compare(input, "Revenues")).toMatchObject({
      status: "available",
      operatingIncomeDifference: "5",
      operatingMarginChange: {
        status: "available",
        prior: "12.5",
        current: "15",
        difference: "2.5",
        direction: "higher",
      },
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(
      Object.isFrozen(availableHistory(input).periods[0]!.observationIds),
    ).toBe(true);
    expect(
      Object.hasOwn(availableHistory(input).periods[1]!, "currentUseEligible"),
    ).toBe(false);
  });

  it("compares unsafe signed full amounts exactly instead of converting operands to Number", () => {
    const input = packet([
      flow("OperatingIncomeLoss", 0, "-9007199254740993.125"),
      flow("OperatingIncomeLoss", 1, "-9007199254740993.124"),
      flow("Revenues", 0, "9007199254740993.125"),
      flow("Revenues", 1, "9007199254740993.124"),
    ]);
    expect(compare(input, "Revenues")).toMatchObject({
      status: "available",
      operatingIncomeDifference: "-0.001",
      operatingMarginChange: {
        prior: "-100",
        current: "-100",
        difference: "0",
        direction: "unchanged",
      },
    });
  });

  it("does not skip a missing adjacent period even when statement axes show an older admitted comparative", () => {
    const input = packet([
      flow("OperatingIncomeLoss"),
      flow("Revenues"),
      flow("OperatingIncomeLoss", 2, "5"),
      flow("Revenues", 2, "60"),
    ]);
    const result = availableHistory(input);
    expect(result.periods).toHaveLength(1);
    expect(result.stoppedReason).toBe("no_report_period");
    expect(compare(input, "Revenues")).toEqual({
      status: "unavailable",
      stage: "prior_pair",
      reason: "no_report_period",
    });
    const statement = resolvePersonalSecAnnualStatements(input).statements.find(
      (value) => value.id === "income_statement",
    )!;
    expect(statement.columns.map((column) => column.endDate)).toEqual([
      ends[0],
      ends[2],
    ]);
    expect(
      statement.rows.find((row) => row.concept === "OperatingIncomeLoss")!
        .cells[1],
    ).toMatchObject({ status: "available", value: "5" });
  });

  it("keeps revenue bases and different history lengths independent without requiring net income", () => {
    const rows = ["15", "10", "5"].map((value, index) =>
      flow("OperatingIncomeLoss", index, value),
    );
    for (const [
      basis,
      concept,
    ] of PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.entries())
      for (let index = 0; index < 3 - basis; index++)
        rows.push(flow(concept, index, String(100 * (basis + 1))));
    const input = packet(rows);
    const results = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) =>
      availableHistory(input, concept),
    );
    expect(results.map((result) => result.periods.length)).toEqual([3, 2, 1]);
    expect(
      results.map((result) => result.periods[0]!.operatingMarginPercent),
    ).toEqual(["15", "7.5", "5"]);
  });

  it.each([485, 486])(
    "keeps current amounts but qualifies history only within the %d-day current-use edge",
    (days) => {
      const input = historyPacket();
      const cutoff = new Date(
        Date.parse(`${ends[0]}T00:00:00.000Z`) + days * 86_400_000,
      ).toISOString();
      input.generation.cutoffAt = cutoff;
      input.generation.completedAt = cutoff;
      for (const source of Object.values(input.generation.sources))
        source.fetchedAt = cutoff;
      expect(resolve(input).operatingIncome).toMatchObject({
        status: "available",
        currentUseEligible: days === 485,
      });
      expect(history(input, "Revenues")).toMatchObject(
        days === 485
          ? { status: "available" }
          : { status: "unavailable", reason: "current_use_unavailable" },
      );
      expect(compare(input, "Revenues")).toMatchObject(
        days === 485
          ? { status: "available" }
          : {
              status: "unavailable",
              stage: "current_pair",
              reason: "current_use_unavailable",
            },
      );
    },
  );

  it("rejects an unregistered revenue comparison instead of selecting a fallback", () => {
    const input = historyPacket();
    expect(() =>
      history(input, "unknown" as PersonalSecAnnualRevenueConcept),
    ).toThrow(TypeError);
    expect(() =>
      compare(input, "unknown" as PersonalSecAnnualRevenueConcept),
    ).toThrow(TypeError);
  });
});
