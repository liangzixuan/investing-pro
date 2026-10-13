import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { normalizePersonalSecAnnualCompanyFacts } from "./personal-sec-annual-company-facts";
import { parsePersonalSecSourceJson } from "./personal-sec-quarterly-evidence-provider";

const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001";
const OCF = "NetCashProvidedByUsedInOperatingActivities";
const PPE = "PaymentsToAcquirePropertyPlantAndEquipment";
function fact(overrides: Record<string, unknown> = {}) {
  return {
    start: "2025-01-01",
    end: "2025-12-31",
    val: 120,
    accn: ACCESSION,
    fy: 2025,
    fp: "FY",
    form: "10-K",
    filed: "2026-02-01",
    ...overrides,
  };
}
function usd(rows: readonly unknown[] = [fact()]) {
  return { units: { USD: rows } };
}
function input(taxonomy: Record<string, unknown> = {}) {
  return {
    cik: 42,
    facts: {
      "us-gaap": {
        Revenues: usd(),
        NetIncomeLoss: usd(),
        [OCF]: usd(),
        [PPE]: usd([fact({ val: 0 })]),
        ...taxonomy,
      },
    },
  };
}
function normalize(
  taxonomy: Record<string, unknown> = {},
  accession: string | null = ACCESSION,
) {
  return normalizePersonalSecAnnualCompanyFacts(
    parsePersonalSecSourceJson(JSON.stringify(input(taxonomy))),
    CIK,
    accession,
  );
}

describe("independent Annual CompanyFacts scans", () => {
  it("admits exact 64-character values and rejects wider or nonnumeric source rows", () => {
    const values = [
      "9".repeat(64),
      "9".repeat(65),
      "0.00000000000000000000000000000000000000000000000000000000000001",
    ];
    for (const [index, decimal] of values.entries()) {
      const text = JSON.stringify(
        input({ [OCF]: usd([fact({ val: 42 })]) }),
      ).replace('"val":42', `"val":${decimal}`);
      const metric = normalizePersonalSecAnnualCompanyFacts(
        parsePersonalSecSourceJson(text),
        CIK,
        ACCESSION,
      ).operatingCashFlow;
      expect(metric.scan).toMatchObject({
        coverage: { full: { invalidRows: index === 1 ? 1 : 0 } },
      });
      expect(metric.observations.map((row) => row.value)).toEqual(
        index === 1 ? [] : [decimal],
      );
    }
  });
  it("preserves exact decimal source metadata, original locators and distinct ordered hash fields", () => {
    const decimal = "-123456789012345678901234567890.000000000000000001";
    const text = JSON.stringify(
      input({ [OCF]: usd([fact(), fact({ val: 42 })]) }),
    ).replace('"val":42', `"val":${decimal}`);
    const result = normalizePersonalSecAnnualCompanyFacts(
      parsePersonalSecSourceJson(text),
      CIK,
      ACCESSION,
    );
    const row = result.operatingCashFlow.observations.find(
      (row) => row.value === decimal,
    )!;
    expect(row.sourceLocator).toBe(`/facts/us-gaap/${OCF}/units/USD/1`);
    expect(row).toMatchObject({
      metric: "operating_cash_flow",
      concept: OCF,
      unit: "USD",
      durationDays: 365,
      periodBasis: "unresolved",
      filingFocusYear: 2025,
      filingFocusPeriod: "FY",
      frame: null,
      accessionNumber: ACCESSION,
    });
    const { id, sourceLocator, ...fields } = row;
    expect(sourceLocator).toBe(`/facts/us-gaap/${OCF}/units/USD/1`);
    expect(id).toBe(
      `sec-fact:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`,
    );
    expect(result.ppePurchases.observations[0]).toMatchObject({
      metric: "ppe_purchases",
      concept: PPE,
      value: "0",
    });
    expect(result.income?.observations).toHaveLength(2);
  });

  it.each([
    null,
    [],
    { cik: 7, facts: {} },
    { cik: 42, facts: null },
    { cik: 42, facts: { "us-gaap": [] } },
  ])("rejects an invalid shared envelope %j", (value) => {
    expect(() =>
      normalizePersonalSecAnnualCompanyFacts(
        parsePersonalSecSourceJson(JSON.stringify(value)),
        CIK,
        ACCESSION,
      ),
    ).toThrow();
  });

  it.each([
    [undefined, "concept_missing"],
    [{ units: { EUR: [fact()] } }, "usd_missing"],
    [usd([]), "empty_usd"],
  ] as const)(
    "distinguishes absence %s without fabricating a zero value",
    (entry, absence) => {
      const result = normalize({ [OCF]: entry });
      expect(result.operatingCashFlow).toEqual({
        scan: {
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
        },
        observations: [],
      });
      expect(result.incomeScanStatus).toBe("available");
      expect(result.ppePurchases.observations).toHaveLength(1);
    },
  );

  it.each([null, [], { units: null }, { units: { USD: {} } }])(
    "isolates malformed cash concept %j",
    (entry) => {
      const result = normalize({ [OCF]: entry });
      expect(result.operatingCashFlow).toEqual({
        scan: { status: "invalid_response", absence: null, coverage: null },
        observations: [],
      });
      expect(result.incomeScanStatus).toBe("available");
      expect(result.ppePurchases.observations).toHaveLength(1);
    },
  );

  it("isolates a malformed income concept from both valid cash scans", () => {
    const result = normalize({ Revenues: null });
    expect(result.incomeScanStatus).toBe("invalid_response");
    expect(result.income).toBeUndefined();
    expect(result.operatingCashFlow.observations).toHaveLength(1);
    expect(result.ppePurchases.observations).toHaveLength(1);
  });

  it("counts invalid and duplicate rows while retaining complete valid selected rows", () => {
    const result = normalize({
      [OCF]: usd([
        fact(),
        fact(),
        fact({ val: "120" }),
        fact({ accn: "0000999999-25-000001" }),
        fact({ start: "2025-10-01", fp: "Q4" }),
      ]),
    });
    expect(result.operatingCashFlow.scan).toEqual({
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 5,
          inspectedRows: 5,
          invalidRows: 1,
          duplicateRows: 1,
          uniqueObservations: 3,
        },
        selected: 2,
        otherAccessions: 1,
        returned: 2,
        omittedSelected: 0,
      },
    });
    expect(
      result.operatingCashFlow.observations
        .map((row) => row.sourceLocator)
        .sort(),
    ).toEqual([
      `/facts/us-gaap/${OCF}/units/USD/0`,
      `/facts/us-gaap/${OCF}/units/USD/4`,
    ]);
  });

  it("counts all unique selected-accession rows before annual filtering and refuses only that metric at 101", () => {
    const rows = Array.from({ length: 101 }, (_, val) =>
      fact({ val, fp: "Q4", start: "2025-10-01" }),
    );
    const atCap = normalize({ [OCF]: usd(rows.slice(0, 100)) });
    expect(atCap.operatingCashFlow.observations).toHaveLength(100);
    const over = normalize({ [OCF]: usd(rows) });
    expect(over.operatingCashFlow.scan).toMatchObject({
      status: "available",
      coverage: { selected: 101, returned: 0, omittedSelected: 101 },
    });
    expect(over.operatingCashFlow.observations).toEqual([]);
    expect(over.ppePurchases.observations).toHaveLength(1);
    expect(over.incomeScanStatus).toBe("available");
  });

  it("bounds each cash candidate scan independently and does not claim inspection after overflow", () => {
    const rows = Array.from({ length: 10_000 }, () => fact());
    const atCap = normalize({ [OCF]: usd(rows), [PPE]: usd(rows) });
    expect(atCap.operatingCashFlow.scan).toMatchObject({
      coverage: {
        full: {
          candidateRows: 10_000,
          inspectedRows: 10_000,
          duplicateRows: 9_999,
        },
      },
    });
    expect(atCap.ppePurchases.observations).toHaveLength(1);
    const over = normalize({ [OCF]: usd([...rows, fact()]) });
    expect(over.operatingCashFlow).toEqual({
      scan: { status: "candidate_limit", absence: null, coverage: null },
      observations: [],
    });
    expect(over.ppePurchases.observations).toHaveLength(1);
    expect(over.incomeScanStatus).toBe("available");
  });

  it("does not let the existing income candidate limit consume cash capacity", () => {
    const result = normalize({
      Revenues: usd(Array.from({ length: 20_001 }, () => fact())),
    });
    expect(result.incomeScanStatus).toBe("candidate_limit");
    expect(result.income).toBeUndefined();
    expect(result.operatingCashFlow.observations).toHaveLength(1);
    expect(result.ppePurchases.observations).toHaveLength(1);
  });

  it("keeps full scan counts but returns no selected rows for an unresolved target", () => {
    const result = normalize({}, null);
    expect(result.operatingCashFlow).toMatchObject({
      scan: {
        coverage: {
          full: { uniqueObservations: 1 },
          selected: null,
          otherAccessions: null,
          returned: 0,
          omittedSelected: null,
        },
      },
      observations: [],
    });
  });
});
