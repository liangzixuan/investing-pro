import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementsDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualStatements as resolve } from "./personal-sec-annual-statements";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";

function cells(
  result: PersonalSecAnnualStatementsDto,
  concept: PersonalSecAnnualStatementConcept,
) {
  return result.statements
    .flatMap((s) => s.rows)
    .find((row) => row.concept === concept)!.cells;
}
function annual(
  concept: PersonalSecAnnualStatementConcept,
  index: number,
  endDate: string,
  startDate: string | null,
  value: string,
) {
  return observation(concept, index, {
    endDate,
    startDate,
    value,
    filingFocusYear: Number(endDate.slice(0, 4)),
    durationDays:
      startDate === null
        ? null
        : (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1,
  });
}
const cash = "NetCashProvidedByUsedInOperatingActivities";

describe("complete annual statement cells", () => {
  it("projects all 32 concepts independently across three flow periods and two balance dates", () => {
    const rows = registry.flatMap((entry, entryIndex) =>
      entry.periodType === "instant"
        ? [
            annual(
              entry.concept,
              0,
              "2025-09-30",
              null,
              entry.concept === "StockholdersEquity"
                ? "-9007199254740993.125"
                : String(entryIndex),
            ),
            annual(entry.concept, 1, "2024-09-30", null, "0"),
          ]
        : [
            annual(
              entry.concept,
              0,
              "2025-09-30",
              "2024-10-01",
              entry.concept === cash
                ? "-9007199254740993.125"
                : String(entryIndex),
            ),
            annual(entry.concept, 1, "2024-09-30", "2023-10-01", "0"),
            annual(entry.concept, 2, "2023-09-30", "2022-10-01", "7.25"),
          ],
    );
    const input = fixture(rows);
    const before = structuredClone(input);
    const result = resolve(input);
    expect(result.contextReason).toBeNull();
    expect(result.statements.map((s) => s.id)).toEqual([
      "income_statement",
      "balance_sheet",
      "cash_flow",
    ]);
    expect(result.statements.flatMap((s) => s.rows)).toHaveLength(32);
    for (const s of result.statements) {
      expect(s.columns.map((c) => c.endDate)).toEqual(
        s.id === "balance_sheet"
          ? ["2025-09-30", "2024-09-30"]
          : ["2025-09-30", "2024-09-30", "2023-09-30"],
      );
      for (const row of s.rows)
        expect(row.cells.every((c) => c.status === "available")).toBe(true);
    }
    expect(cells(result, cash)[0]).toMatchObject({
      status: "available",
      value: "-9007199254740993.125",
      startDate: "2024-10-01",
      currentUseEligible: true,
    });
    expect(cells(result, "StockholdersEquity")[0]).toMatchObject({
      status: "available",
      value: "-9007199254740993.125",
      startDate: null,
    });
    expect(cells(result, "Revenues")[1]).toMatchObject({
      status: "available",
      value: "0",
      startDate: "2023-10-01",
      currentUseEligible: false,
    });
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(
      Object.isFrozen(result.statements[0]!.rows[0]!.cells[0]!.observationIds),
    ).toBe(true);
    input.facts.observations[0]!.value = "999";
    expect(result).not.toEqual(resolve(input));
  });
  it("keeps three revenue bases separate with no substitution, sum, or income gate", () => {
    const result = resolve(
      fixture([
        observation("RevenueFromContractWithCustomerExcludingAssessedTax", 0, {
          value: "0",
        }),
        observation("Revenues", 0, { value: "-20" }),
        observation(cash, 0, { value: "12.5" }),
        observation("StockholdersEquity", 0, { value: "-8" }),
      ]),
    );
    expect(
      cells(result, "RevenueFromContractWithCustomerExcludingAssessedTax")[0],
    ).toMatchObject({ status: "available", value: "0" });
    expect(cells(result, "Revenues")[0]).toMatchObject({
      status: "available",
      value: "-20",
    });
    expect(cells(result, "SalesRevenueNet")[0]).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(cells(result, "NetIncomeLoss")[0]).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(cells(result, cash)[0]).toMatchObject({
      status: "available",
      value: "12.5",
    });
    expect(cells(result, "StockholdersEquity")[0]).toMatchObject({
      status: "available",
      value: "-8",
    });
  });
  it("exposes valid different starts across concepts and refuses conflicting starts within a concept", () => {
    const income = annual("NetIncomeLoss", 0, "2025-09-30", "2024-09-30", "4");
    let result = resolve(fixture([observation("Revenues"), income]));
    expect(cells(result, "Revenues")[0]).toMatchObject({
      status: "available",
      startDate: "2024-10-01",
    });
    expect(cells(result, "NetIncomeLoss")[0]).toMatchObject({
      status: "available",
      startDate: "2024-09-30",
    });
    const conflicting = annual(
      "Revenues",
      1,
      "2025-09-30",
      "2024-09-30",
      "9007199254740993.125",
    );
    result = resolve(fixture([observation("Revenues"), conflicting, income]));
    expect(cells(result, "Revenues")[0]).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_period",
    });
    expect(cells(result, "Revenues")[0]!.observationIds).toHaveLength(2);
    expect(cells(result, "NetIncomeLoss")[0]!.status).toBe("available");
  });
  it("refuses value conflicts without selecting a winner or filling from an older period", () => {
    const result = resolve(
      fixture([
        observation("Revenues", 0, { value: "4" }),
        observation("Revenues", 1, { value: "5" }),
        annual("Revenues", 2, "2024-09-30", "2023-10-01", "7"),
      ]),
    );
    expect(cells(result, "Revenues")[0]).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    expect(cells(result, "Revenues")[1]).toMatchObject({
      status: "available",
      value: "7",
      currentUseEligible: false,
    });
  });
  it("keeps all agreeing observation references without clipping", () => {
    const result = resolve(
      fixture(
        Array.from({ length: 100 }, (_, i) =>
          observation(cash, i, { value: "-8.125" }),
        ),
      ),
    );
    expect(cells(result, cash)[0]).toMatchObject({
      status: "available",
      value: "-8.125",
    });
    expect(cells(result, cash)[0]!.observationIds).toHaveLength(100);
  });
  it.each([
    ["quarter", { startDate: "2025-07-01" }, "invalid_annual_period"],
    ["YTD", { startDate: "2025-01-01" }, "invalid_annual_period"],
    [
      "instant flow",
      { startDate: null, durationDays: null },
      "invalid_annual_period",
    ],
    ["missing FY", { filingFocusPeriod: null }, "missing_or_non_FY_focus"],
    ["Q4 focus", { filingFocusPeriod: "Q4" }, "missing_or_non_FY_focus"],
    [
      "duration below 335",
      { startDate: "2024-11-01" },
      "invalid_annual_period",
    ],
    [
      "duration above 395",
      { startDate: "2024-08-31" },
      "invalid_annual_period",
    ],
  ] as const)(
    "refuses %s without blocking a cash sibling",
    (_label, changes, reason) => {
      const result = resolve(
        fixture([observation("Revenues", 0, changes), observation(cash)]),
      );
      expect(cells(result, "Revenues")[0]).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(cells(result, cash)[0]!.status).toBe("available");
    },
  );
  it.each([335, 395])(
    "accepts the existing inclusive %i-day FY boundary",
    (days) => {
      const startDate = new Date(
        Date.parse("2025-09-30") - (days - 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      expect(
        cells(
          resolve(fixture([observation("Revenues", 0, { startDate })])),
          "Revenues",
        )[0]!.status,
      ).toBe("available");
    },
  );
  it("refuses duration balance facts and retains a valid independent instant", () => {
    const result = resolve(
      fixture([
        observation("Assets", 0, { startDate: "2024-10-01" }),
        observation("StockholdersEquity", 0, { value: "-5" }),
      ]),
    );
    expect(cells(result, "Assets")[0]).toMatchObject({
      status: "unavailable",
      reason: "invalid_instant_period",
    });
    expect(cells(result, "StockholdersEquity")[0]!.status).toBe("available");
  });
  it.each(["metadata_conflict", "not_in_current_submissions"] as const)(
    "retains a %s refusal and source references",
    (status) => {
      const base = observation("Revenues");
      const filing =
        status === "metadata_conflict"
          ? { ...base.filing, status }
          : {
              status,
              form: null,
              filedDate: null,
              reportDate: null,
              acceptedAt: null,
              sourceUrl: null,
            };
      const row = observation("Revenues", 0, { filing });
      const result = resolve(fixture([row, observation(cash)]));
      expect(cells(result, "Revenues")[0]).toEqual({
        endDate: row.endDate,
        observationIds: [row.id],
        status: "unavailable",
        reason: "filing_unmatched_or_conflicted",
      });
      expect(cells(result, cash)[0]!.status).toBe("available");
    },
  );
  it("retains legal unsupported raw forms and refuses them before a conflicted join", () => {
    const base = observation("Revenues");
    const result = resolve(
      fixture([
        observation("Revenues", 0, {
          form: "10-K/A",
          filing: { ...base.filing, status: "metadata_conflict" },
        }),
      ]),
    );
    expect(cells(result, "Revenues")[0]).toMatchObject({
      status: "unavailable",
      reason: "unsupported_form",
    });
  });
  it("admits 20-F with the same FY and exact-period policy", () => {
    const input = fixture([observation(cash)]);
    if (input.target.status !== "target") throw Error();
    input.target.form = "20-F";
    input.facts.observations[0]!.form = "20-F";
    input.facts.observations[0]!.filing.form = "20-F";
    expect(cells(resolve(input), cash)[0]!.status).toBe("available");
  });
  it("takes only the latest two eligible earlier dates for each statement, never quarterly or future dates", () => {
    const rows = [
      annual(cash, 0, "2025-09-30", "2024-10-01", "1"),
      annual(cash, 1, "2024-09-30", "2023-10-01", "2"),
      annual(cash, 2, "2023-09-30", "2022-10-01", "3"),
      annual(cash, 3, "2022-09-30", "2021-10-01", "4"),
      annual(cash, 4, "2025-06-30", "2025-04-01", "5"),
      annual(cash, 5, "2025-12-31", "2025-01-01", "6"),
      annual("Assets", 0, "2025-09-30", null, "7"),
      annual("Assets", 1, "2024-09-30", null, "8"),
    ];
    const result = resolve(fixture(rows));
    expect(
      result.statements
        .find((s) => s.id === "cash_flow")!
        .columns.map((c) => c.endDate),
    ).toEqual(["2025-09-30", "2024-09-30", "2023-09-30"]);
    expect(
      result.statements
        .find((s) => s.id === "balance_sheet")!
        .columns.map((c) => c.endDate),
    ).toEqual(["2025-09-30", "2024-09-30"]);
    expect(
      result.statements
        .find((s) => s.id === "income_statement")!
        .columns.map((c) => c.endDate),
    ).toEqual(["2025-09-30"]);
  });
  it("shows missing selected periods without using a prior value", () => {
    const result = resolve(
      fixture([annual(cash, 0, "2024-09-30", "2023-10-01", "7")]),
    );
    expect(cells(result, cash)[0]).toEqual({
      endDate: "2025-09-30",
      observationIds: [],
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(cells(result, cash)[1]).toMatchObject({
      status: "available",
      value: "7",
    });
  });
  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "retains independent %s absence",
    (absence) => {
      const input = fixture([observation(cash)]);
      const scan = input.facts.scans.find(
        (s) => s.concept === "Revenues",
      )!.scan;
      if (scan.status !== "available") throw Error();
      scan.absence = absence;
      const result = resolve(input);
      expect(cells(result, "Revenues")[0]).toMatchObject({
        status: "unavailable",
        reason: absence,
      });
      expect(cells(result, cash)[0]!.status).toBe("available");
    },
  );
  it.each(["invalid_response", "candidate_limit"] as const)(
    "isolates a %s scan",
    (status) => {
      const input = fixture([observation(cash)]);
      setScan(input, "Revenues", { status, absence: null, coverage: null });
      const result = resolve(input);
      expect(cells(result, "Revenues")[0]).toMatchObject({
        status: "unavailable",
        reason: status,
      });
      expect(cells(result, cash)[0]!.status).toBe("available");
    },
  );
  it.each(["invalid_source_rows", "selected_report_overflow"] as const)(
    "isolates %s and never returns a partial concept",
    (reason) => {
      const input = fixture([observation(cash)]);
      const count = reason === "selected_report_overflow" ? 101 : 0;
      const invalid = reason === "invalid_source_rows" ? 1 : 0;
      setScan(input, "Revenues", {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: count + invalid,
            inspectedRows: count + invalid,
            invalidRows: invalid,
            duplicateRows: 0,
            uniqueObservations: count,
          },
          selected: count,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: count,
        },
      });
      const result = resolve(input);
      expect(cells(result, "Revenues")[0]).toMatchObject({
        status: "unavailable",
        reason,
        observationIds: [],
      });
      expect(cells(result, cash)[0]!.status).toBe("available");
    },
  );
});

describe("annual statement context and ownership", () => {
  it.each([
    [
      "completion before cutoff",
      (v: Fixture): void => {
        v.generation.completedAt = "2026-02-02T05:00:00.000Z";
      },
      "invalid_clock",
    ],
    [
      "capture before cutoff",
      (v: Fixture): void => {
        v.generation.sources.companyFacts.fetchedAt =
          "2026-02-02T05:00:00.000Z";
      },
      "invalid_clock",
    ],
    [
      "capture after completion",
      (v: Fixture): void => {
        v.generation.sources.companyFacts.fetchedAt =
          "2026-02-02T07:00:00.000Z";
      },
      "invalid_clock",
    ],
    [
      "stale source",
      (v: Fixture): void => {
        v.generation.completedAt = "2026-02-09T06:00:02.001Z";
      },
      "source_stale",
    ],
    [
      "future filing",
      (v: Fixture) => {
        if (v.target.status !== "target") throw Error();
        v.target.filedDate = "2026-02-03";
        for (const row of v.facts.observations) {
          row.filedDate = v.target.filedDate;
          row.filing.filedDate = v.target.filedDate;
        }
      },
      "future_or_inconsistent_dates",
    ],
    [
      "future acceptance",
      (v: Fixture) => {
        if (v.target.status !== "target") throw Error();
        v.target.acceptedAt = "2026-02-02T07:00:00.000Z";
        for (const row of v.facts.observations)
          row.filing.acceptedAt = v.target.acceptedAt;
      },
      "future_or_inconsistent_dates",
    ],
    [
      "same-day unknown acceptance",
      (v: Fixture) => {
        if (v.target.status !== "target") throw Error();
        v.target.filedDate = "2026-02-02";
        v.target.acceptedAt = null;
        for (const row of v.facts.observations) {
          row.filedDate = v.target.filedDate;
          row.filing.filedDate = v.target.filedDate;
          row.filing.acceptedAt = null;
        }
      },
      "cutoff_time_unresolved",
    ],
  ] as const)(
    "returns deterministic %s context and real target cells",
    (_label, mutate, reason) => {
      const input = fixture([observation(cash)]);
      mutate(input);
      const result = resolve(input);
      expect(result.contextReason).toBe(reason);
      expect(result.statements.every((s) => s.columns.length === 1)).toBe(true);
      expect(cells(result, cash)[0]).toMatchObject({
        status: "unavailable",
        reason,
        observationIds: [input.facts.observations[0]!.id],
      });
    },
  );
  it("returns empty columns and cells with an explicit unresolved-target reason", () => {
    const input = fixture();
    input.target = { status: "unresolved", reason: "target_ambiguous" };
    for (const item of input.facts.scans)
      if (item.scan.status === "available")
        Object.assign(item.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    const result = resolve(input);
    expect(result.contextReason).toBe("target_unresolved");
    expect(result.utilityAge).toBeNull();
    expect(
      result.statements.every(
        (s) =>
          s.columns.length === 0 && s.rows.every((r) => r.cells.length === 0),
      ),
    ).toBe(true);
  });
  it("refuses all real-date cells when a source is unavailable", () => {
    const input = fixture([observation(cash)]);
    input.generation.sources.companyFacts = {
      ...input.generation.sources.companyFacts,
      status: "rate_limited",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    input.facts.observations = [];
    for (const item of input.facts.scans)
      setScan(input, item.concept, {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      });
    const result = resolve(input);
    expect(result.contextReason).toBe("source_unavailable");
    expect(cells(result, cash)[0]).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    expect(result.utilityAge).toBeNull();
  });
  it("retains a historical target as available evidence but removes current-use eligibility after day 485", () => {
    for (const days of [485, 486]) {
      const input = fixture([observation(cash)]);
      const cutoff = new Date(
        Date.parse("2025-09-30") + days * 86400000,
      ).toISOString();
      input.generation.cutoffAt = cutoff;
      input.generation.sources.companyFacts.fetchedAt = cutoff;
      input.generation.sources.submissions.fetchedAt = cutoff;
      input.generation.completedAt = cutoff;
      const result = resolve(input);
      expect(result.contextReason).toBeNull();
      expect(cells(result, cash)[0]).toMatchObject({
        status: "available",
        currentUseEligible: days === 485,
      });
      expect(result.utilityAge?.endAgeDays).toBe(days);
    }
  });
  it("accepts exactly seven source-age days and refuses one millisecond more", () => {
    const input = fixture([observation(cash)]);
    input.generation.sources.companyFacts.fetchedAt =
      "2026-02-02T06:00:00.000Z";
    input.generation.sources.submissions.fetchedAt = "2026-02-02T06:00:00.000Z";
    input.generation.completedAt = "2026-02-09T06:00:00.000Z";
    expect(cells(resolve(input), cash)[0]!.status).toBe("available");
    input.generation.completedAt = "2026-02-09T06:00:00.001Z";
    expect(resolve(input).contextReason).toBe("source_stale");
  });
  it("rejects other-accession selected rows and never admits a legacy packet fallback", () => {
    const input = fixture([
      observation(cash, 0, { accessionNumber: "0000999999-25-000001" }),
    ]);
    expect(() => resolve(input)).toThrow(TypeError);
    expect(() => resolve({ ...fixture(), income: {} } as Fixture)).toThrow(
      TypeError,
    );
  });
  it("returns deeply frozen owned arrays and leaves the source graph mutable", () => {
    const input = fixture([observation(cash)]);
    const result = resolve(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.utilityAge?.sourceAgeDays)).toBe(true);
    expect(Object.isFrozen(result.statements[2]!.columns)).toBe(true);
    expect(() => {
      (cells(result, cash)[0]!.observationIds as string[]).push("fake");
    }).toThrow(TypeError);
    expect(Object.isFrozen(input.facts.observations)).toBe(false);
  });
});
