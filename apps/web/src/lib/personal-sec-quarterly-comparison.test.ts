import type {
  PersonalSecQuarterlyEvidenceDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import { comparePersonalSecQuarterlyObservations } from "./personal-sec-quarterly-comparison";

function observation(
  index = 1,
  patch: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  const accessionNumber =
    patch.accessionNumber ?? `0000000042-26-${String(index).padStart(6, "0")}`;
  const form = patch.form ?? "10-Q";
  const filedDate = patch.filedDate ?? "2026-08-01";
  return {
    id: `sec-fact:${index.toString(16).padStart(64, "0")}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "123.45",
    startDate: "2025-04-01",
    endDate: "2025-06-30",
    durationDays: 91,
    periodBasis: "unresolved",
    filingFocusYear: 2026,
    filingFocusPeriod: "Q2",
    frame: "CY2025Q2",
    accessionNumber,
    form,
    filedDate,
    sourceLocator: `/facts/us-gaap/${patch.concept ?? "Revenues"}/units/USD/${index}`,
    filing: {
      status: "matched",
      form,
      filedDate,
      reportDate: "2026-06-30",
      acceptedAt: `${filedDate}T16:00:00Z`,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accessionNumber}-index.htm`,
    },
    ...patch,
  };
}

function evidence(
  observations: readonly PersonalSecQuarterlyObservationDto[],
  patch: Partial<PersonalSecQuarterlyEvidenceDto> = {},
): PersonalSecQuarterlyEvidenceDto {
  const cik = patch.cik ?? "0000000042";
  return {
    cik,
    fetchedAt: "2026-09-10T08:00:00.000Z",
    sources: {
      companyFacts: {
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      },
      submissions: {
        status: "available",
        sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
      },
    },
    olderHistoryAvailable: false,
    coverage: {
      inspectedRows: observations.length,
      invalidRows: 0,
      duplicateRows: 0,
      availableObservations: observations.length,
      returnedObservations: observations.length,
      truncated: false,
      conceptsWithoutUsd: [],
    },
    observations,
    ttm: { status: "unavailable", reason: "period_and_revision_not_admitted" },
    ...patch,
  };
}

describe("same-period SEC observation comparison", () => {
  it("returns no comparison when the selected observation is absent or the response has no rows", () => {
    expect(
      comparePersonalSecQuarterlyObservations(evidence([]), "missing"),
    ).toBeNull();
    expect(
      comparePersonalSecQuarterlyObservations(
        evidence([observation()]),
        "missing",
      ),
    ).toBeNull();
  });

  it("preserves a single source observation without inventing another filing or a preferred revision", () => {
    const row = observation();
    const result = comparePersonalSecQuarterlyObservations(
      evidence([row]),
      row.id,
    );
    expect(result).toEqual({
      status: "compared",
      cik: "0000000042",
      selected: row,
      rows: [row],
      relation: "single_observation",
      distinctAccessions: 1,
      distinctValues: 1,
      conflictingAccessions: [],
    });
    expect(result).not.toHaveProperty("preferredRevision");
    expect(result).not.toHaveProperty("restatement");
  });

  it("does not call missing start dates a shared period even when several unknown-start observations agree", () => {
    const rows = [
      observation(1, { startDate: null, durationDays: null }),
      observation(2, { startDate: null, durationDays: null }),
    ];
    const result = comparePersonalSecQuarterlyObservations(
      evidence(rows),
      rows[0]!.id,
    );
    expect(result).toEqual({
      status: "missing_period",
      cik: "0000000042",
      selected: rows[0],
    });
    expect(result).not.toHaveProperty("rows");
    expect(result).not.toHaveProperty("relation");
  });

  it("keeps same-end three/six/nine-month observations, missing starts and other end dates outside the selected period", () => {
    const selected = observation();
    const otherDates = [
      observation(2, { startDate: "2025-01-01", durationDays: 181 }),
      observation(3, { startDate: "2024-10-01", durationDays: 273 }),
      observation(4, { startDate: null, durationDays: null }),
      observation(5, { endDate: "2025-06-29", durationDays: 90 }),
    ];
    const result = comparePersonalSecQuarterlyObservations(
      evidence([...otherDates, selected]),
      selected.id,
    );
    expect(result).toMatchObject({
      status: "compared",
      rows: [selected],
      relation: "single_observation",
    });
  });

  it("does not stitch revenue aliases or net-income observations into the chosen concept", () => {
    const selected = observation();
    const rows = [
      selected,
      observation(2, { concept: "SalesRevenueNet" }),
      observation(3, {
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
      }),
      observation(4, { concept: "NetIncomeLoss", metric: "net_income" }),
    ];
    expect(
      comparePersonalSecQuarterlyObservations(evidence(rows), selected.id),
    ).toMatchObject({
      status: "compared",
      rows: [selected],
      distinctAccessions: 1,
    });
  });

  it("uses the exact tuple rather than numeric values or filing-focus metadata for membership", () => {
    const selected = observation();
    const newerFocus = observation(2, {
      filingFocusYear: 2027,
      filingFocusPeriod: "FY",
      frame: null,
      form: "10-K",
      filedDate: "2027-02-01",
      value: "124",
    });
    const result = comparePersonalSecQuarterlyObservations(
      evidence([newerFocus, selected]),
      selected.id,
    );
    expect(result).toMatchObject({
      status: "compared",
      rows: [selected, newerFocus],
      relation: "different_values",
      distinctAccessions: 2,
      distinctValues: 2,
    });
    if (result?.status !== "compared") throw Error("Expected comparison");
    expect(result.rows[0]!.startDate).toBe("2025-04-01");
    expect(result.rows[1]!.filingFocusYear).toBe(2027);
    expect(result.rows.every((row) => row.periodBasis === "unresolved")).toBe(
      true,
    );
  });

  it.each([
    ["0", "0", "same_value"],
    ["-10.25", "-10.25", "same_value"],
    ["-10.25", "-10.250000000001", "different_values"],
    ["9007199254740992", "9007199254740993", "different_values"],
    ["9".repeat(64), "9".repeat(63) + "8", "different_values"],
    [`0.${"0".repeat(61)}1`, `0.${"0".repeat(61)}2`, "different_values"],
    ["-" + "9".repeat(63), "-" + "9".repeat(63), "same_value"],
  ] as const)(
    "compares canonical decimals %s and %s exactly",
    (first, second, relation) => {
      const rows = [
        observation(1, { value: first }),
        observation(2, { value: second }),
      ];
      const result = comparePersonalSecQuarterlyObservations(
        evidence(rows),
        rows[0]!.id,
      );
      expect(result).toMatchObject({
        status: "compared",
        relation,
        distinctAccessions: 2,
        distinctValues: relation === "same_value" ? 1 : 2,
        conflictingAccessions: [],
      });
      if (result?.status !== "compared") throw Error("Expected comparison");
      expect(result.rows.map((row) => row.value)).toEqual([first, second]);
    },
  );

  it("preserves metadata-distinct rows without counting one accession as multiple filings", () => {
    const first = observation();
    const metadataVariant = observation(2, {
      accessionNumber: first.accessionNumber,
      filingFocusYear: 2025,
      frame: null,
    });
    expect(
      comparePersonalSecQuarterlyObservations(
        evidence([first, metadataVariant]),
        first.id,
      ),
    ).toMatchObject({
      status: "compared",
      relation: "same_value",
      rows: [first, metadataVariant],
      distinctAccessions: 1,
      distinctValues: 1,
      conflictingAccessions: [],
    });
  });

  it("reports all conflicting accessions independently from differences between filings", () => {
    const first = observation(1);
    const second = observation(2, { value: "130" });
    const rows = [
      observation(3, { accessionNumber: second.accessionNumber, value: "131" }),
      first,
      observation(4, { accessionNumber: first.accessionNumber, value: "120" }),
      second,
      observation(5, { value: "140" }),
    ];
    const result = comparePersonalSecQuarterlyObservations(
      evidence(rows),
      first.id,
    );
    expect(result).toMatchObject({
      status: "compared",
      relation: "different_values",
      distinctAccessions: 3,
      distinctValues: 5,
      conflictingAccessions: [first.accessionNumber, second.accessionNumber],
    });
  });

  it("flags a conflicting single accession even without a second observed filing", () => {
    const first = observation();
    const other = observation(2, {
      accessionNumber: first.accessionNumber,
      value: "-1",
    });
    expect(
      comparePersonalSecQuarterlyObservations(
        evidence([first, other]),
        first.id,
      ),
    ).toMatchObject({
      status: "compared",
      relation: "different_values",
      distinctAccessions: 1,
      distinctValues: 2,
      conflictingAccessions: [first.accessionNumber],
    });
  });

  it("orders oldest filed dates first with deterministic accession, form and id ties, independent of selection", () => {
    const a = observation(1, { filedDate: "2025-08-01" });
    const b = observation(2, { filedDate: "2026-08-01" });
    const c = observation(3, {
      accessionNumber: b.accessionNumber,
      form: "10-Q/A",
    });
    const d = observation(4, {
      accessionNumber: c.accessionNumber,
      form: c.form,
      frame: null,
    });
    const input = evidence([d, c, b, a]);
    const first = comparePersonalSecQuarterlyObservations(input, a.id);
    const second = comparePersonalSecQuarterlyObservations(input, d.id);
    expect(first).toMatchObject({ rows: [a, b, c, d], selected: a });
    expect(second).toMatchObject({ rows: [a, b, c, d], selected: d });
    if (second?.status !== "compared") throw Error("Expected comparison");
    expect(second.selected).toBe(second.rows[3]);
  });

  it("retains unmatched/conflicting submission metadata without treating it as verification or discarding observations", () => {
    const first = observation();
    const unmatched = observation(2, {
      filing: {
        status: "not_in_current_submissions",
        form: null,
        filedDate: null,
        reportDate: null,
        acceptedAt: null,
        sourceUrl: null,
      },
    });
    const conflict = observation(3, {
      filing: {
        ...observation(3).filing,
        status: "metadata_conflict",
        form: "10-K",
      },
    });
    const result = comparePersonalSecQuarterlyObservations(
      evidence([first, unmatched, conflict], { olderHistoryAvailable: true }),
      first.id,
    );
    expect(result).toMatchObject({
      status: "compared",
      rows: [first, unmatched, conflict],
      relation: "same_value",
      distinctAccessions: 3,
    });
  });

  it("compares the complete bounded response, including matching rows beyond a visible page and metric filter", () => {
    const rows = Array.from({ length: 200 }, (_, index) =>
      observation(
        index + 1,
        index < 100
          ? { value: index === 99 ? "124" : "123.45" }
          : { metric: "net_income", concept: "NetIncomeLoss", value: "-100" },
      ),
    );
    const input = evidence(rows, {
      coverage: {
        inspectedRows: 230,
        invalidRows: 1,
        duplicateRows: 2,
        availableObservations: 227,
        returnedObservations: 200,
        truncated: true,
        conceptsWithoutUsd: [],
      },
      olderHistoryAvailable: true,
    });
    const result = comparePersonalSecQuarterlyObservations(input, rows[0]!.id);
    expect(result).toMatchObject({
      status: "compared",
      relation: "different_values",
      distinctAccessions: 100,
      distinctValues: 2,
    });
    if (result?.status !== "compared") throw Error("Expected comparison");
    expect(result.rows).toHaveLength(100);
    expect(result.rows.at(-1)!.value).toBe("124");
    expect(input.coverage.truncated).toBe(true);
  });

  it("scopes each comparison to one response CIK and does not retain another response's rows", () => {
    const first = observation();
    const a = comparePersonalSecQuarterlyObservations(
      evidence([first, observation(2)]),
      first.id,
    );
    const b = comparePersonalSecQuarterlyObservations(
      evidence(
        [
          observation(1, {
            filing: {
              ...first.filing,
              sourceUrl: `https://www.sec.gov/Archives/edgar/data/99/${first.accessionNumber}-index.htm`,
            },
          }),
        ],
        { cik: "0000000099" },
      ),
      first.id,
    );
    expect(a).toMatchObject({ cik: "0000000042", distinctAccessions: 2 });
    expect(b).toMatchObject({
      cik: "0000000099",
      distinctAccessions: 1,
      relation: "single_observation",
    });
  });

  it.each([false, true])(
    "owns and freezes output without freezing or mutating input (missing period %s)",
    (missing) => {
      const selected = observation(
        1,
        missing ? { startDate: null, durationDays: null } : {},
      );
      const other = observation(2, { value: "125" });
      const input = evidence([other, selected]);
      const before = JSON.stringify(input);
      const result = comparePersonalSecQuarterlyObservations(
        input,
        selected.id,
      );
      expect(JSON.stringify(input)).toBe(before);
      expect(Object.isFrozen(input)).toBe(false);
      expect(Object.isFrozen(selected)).toBe(false);
      expect(Object.isFrozen(selected.filing)).toBe(false);
      function frozen(value: unknown): void {
        if (typeof value !== "object" || value === null) return;
        expect(Object.isFrozen(value)).toBe(true);
        for (const child of Object.values(value)) frozen(child);
      }
      frozen(result);
      expect(result!.selected).not.toBe(selected);
      expect(result!.selected.filing).not.toBe(selected.filing);
    },
  );
});
