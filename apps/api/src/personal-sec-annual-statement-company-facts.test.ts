import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualStatementConcept,
} from "@research-cockpit/contracts";
import {
  normalizePersonalSecAnnualStatementCompanyFacts,
  unavailablePersonalSecAnnualStatementCompanyFacts,
  type PersonalSecAnnualStatementCompanyFacts,
} from "./personal-sec-annual-statement-company-facts";
import {
  parsePersonalSecSourceJson,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";

const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001";
const OTHER = "0000999999-25-000001";
const OCF = "NetCashProvidedByUsedInOperatingActivities";
function fact(overrides: Record<string, unknown> = {}) {
  return {
    start: "2025-01-01",
    end: "2025-12-31",
    val: 100,
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
function parsed(
  taxonomy: Record<string, unknown> = {},
  numbers: readonly string[] = [],
): unknown {
  let text = JSON.stringify({ cik: 42, facts: { "us-gaap": taxonomy } });
  // Replace invented JSON string placeholders with numeric source lexemes before
  // the real source parser sees them. No unsafe value passes through Number.
  numbers.forEach((lexeme, index) => {
    text = text.replaceAll(JSON.stringify(`__number_${index}__`), lexeme);
  });
  return parsePersonalSecSourceJson(text);
}
function normalize(
  taxonomy: Record<string, unknown> = {},
  accession: string | null = ACCESSION,
  numbers: readonly string[] = [],
) {
  return normalizePersonalSecAnnualStatementCompanyFacts(
    parsed(taxonomy, numbers),
    CIK,
    accession,
  );
}
function scan(
  result: PersonalSecAnnualStatementCompanyFacts,
  concept: PersonalSecAnnualStatementConcept,
) {
  const item = result.scans.find((item) => item.concept === concept);
  if (!item) throw new Error("The fixed concept scan is missing");
  return item.scan;
}
function rows(
  result: PersonalSecAnnualStatementCompanyFacts,
  concept: PersonalSecAnnualStatementConcept,
) {
  return result.observations.filter((row) => row.concept === concept);
}

describe("fixed annual statement Company Facts normalization", () => {
  it.each([
    "source_unavailable",
    "invalid_response",
    "candidate_limit",
  ] as const)(
    "represents a whole-source %s failure in every immutable registry-ordered scan",
    (status) => {
      const result = unavailablePersonalSecAnnualStatementCompanyFacts(status);
      expect(result.registryVersion).toBe("1.0.0");
      expect(result.observations).toEqual([]);
      expect(result.scans.map((item) => item.concept)).toEqual(
        PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
      );
      for (const item of result.scans) {
        expect(item.scan).toEqual({ status, absence: null, coverage: null });
        expect(Object.isFrozen(item)).toBe(true);
        expect(Object.isFrozen(item.scan)).toBe(true);
      }
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.scans)).toBe(true);
      expect(Object.isFrozen(result.observations)).toBe(true);
    },
  );

  it("returns all 32 independently named scans and one immutable graph in registry order", () => {
    const taxonomy = Object.fromEntries(
      [...PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY]
        .reverse()
        .map((entry, index) => [
          entry.concept,
          usd([
            fact({
              val: index + 1,
              start: entry.periodType === "instant" ? undefined : "2025-01-01",
            }),
          ]),
        ]),
    );
    const result = normalize(taxonomy);
    expect(result.registryVersion).toBe("1.0.0");
    expect(result.scans).toHaveLength(32);
    expect(result.scans.map((item) => item.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
    );
    expect(result.observations.map((row) => row.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
    );
    for (const row of result.observations) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(row).not.toHaveProperty("filing");
      expect(row).not.toHaveProperty("metric");
      expect(row.periodBasis).toBe("unresolved");
    }
    for (const item of result.scans) {
      expect(item.scan).toMatchObject({
        status: "available",
        absence: null,
        coverage: {
          full: { candidateRows: 1, inspectedRows: 1, uniqueObservations: 1 },
          selected: 1,
          returned: 1,
          omittedSelected: 0,
        },
      });
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(item.scan)).toBe(true);
      if (item.scan.status === "available") {
        expect(Object.isFrozen(item.scan.coverage)).toBe(true);
        expect(Object.isFrozen(item.scan.coverage.full)).toBe(true);
      }
    }
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.scans)).toBe(true);
    expect(Object.isFrozen(result.observations)).toBe(true);
  });

  it("keeps signed unsafe integers, fractions and exponent numbers exact and binds IDs to the shared serializer", () => {
    const source = [
      "-900719925474099312345.000000000000000001",
      "9007199254740993",
      "-1.234567890123456789e+20",
      "1e-18",
      "-0e+10",
    ];
    const result = normalize(
      {
        [OCF]: usd(
          source.map((_, index) =>
            fact({ val: `__number_${index}__`, frame: `CY202${index}` }),
          ),
        ),
      },
      ACCESSION,
      source,
    );
    const values = rows(result, OCF)
      .map((row) => row.value)
      .sort();
    expect(values).toEqual(
      [
        "-900719925474099312345.000000000000000001",
        "9007199254740993",
        "-123456789012345678900",
        "0.000000000000000001",
        "0",
      ].sort(),
    );
    for (const row of rows(result, OCF)) {
      const { id, sourceLocator, ...fields } = row;
      expect(id).toBe(
        `sec-fact:${createHash("sha256").update(serializePersonalSecAnnualStatementObservation(fields)).digest("hex")}`,
      );
      expect(sourceLocator).toMatch(
        /^\/facts\/us-gaap\/NetCashProvidedByUsedInOperatingActivities\/units\/USD\/[0-4]$/u,
      );
      expect(fields).toMatchObject({
        taxonomy: "us-gaap",
        unit: "USD",
        durationDays: 365,
        filingFocusYear: 2025,
        filingFocusPeriod: "FY",
        accessionNumber: ACCESSION,
      });
    }
  });

  it("accepts exactly 64 decimal characters and rejects an expanded 65-character amount independently", () => {
    const result = normalize(
      {
        Revenues: usd([
          fact({ val: "__number_0__" }),
          fact({ val: "__number_1__" }),
        ]),
        [OCF]: usd(),
      },
      ACCESSION,
      ["9".repeat(64), "1e64"],
    );
    expect(rows(result, "Revenues").map((row) => row.value)).toEqual([
      "9".repeat(64),
    ]);
    expect(scan(result, "Revenues")).toMatchObject({
      coverage: {
        full: { candidateRows: 2, invalidRows: 1, uniqueObservations: 1 },
        selected: 1,
        returned: 1,
      },
    });
    expect(rows(result, OCF)).toHaveLength(1);
  });

  it("preserves all three revenue bases independently even with equal amounts", () => {
    const concepts = [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ] as const;
    const result = normalize(
      Object.fromEntries(concepts.map((concept) => [concept, usd()])),
    );
    expect(result.observations.map((row) => row.concept)).toEqual(concepts);
    expect(new Set(result.observations.map((row) => row.id)).size).toBe(3);
    const missing = normalize({
      Revenues: null,
      SalesRevenueNet: usd([fact({ val: -100 })]),
      [concepts[0]]: usd(),
    });
    expect(scan(missing, "Revenues")).toEqual({
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    expect(rows(missing, concepts[0])).toHaveLength(1);
    expect(rows(missing, "SalesRevenueNet")[0]!.value).toBe("-100");
  });

  it("keeps valid cash and negative parent equity when income is absent or malformed", () => {
    const result = normalize({
      Revenues: { units: null },
      NetIncomeLoss: { units: { USD: "bad" } },
      [OCF]: usd([fact({ val: -120 })]),
      StockholdersEquity: usd([
        fact({ start: undefined, val: -20.125, frame: "CY2025Q4I" }),
      ]),
    });
    expect(
      scan(result, "RevenueFromContractWithCustomerExcludingAssessedTax"),
    ).toMatchObject({ status: "available", absence: "concept_missing" });
    expect(scan(result, "Revenues").status).toBe("invalid_response");
    expect(scan(result, "NetIncomeLoss").status).toBe("invalid_response");
    expect(rows(result, OCF)[0]).toMatchObject({
      value: "-120",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      durationDays: 365,
    });
    expect(rows(result, "StockholdersEquity")[0]).toMatchObject({
      value: "-20.125",
      startDate: null,
      endDate: "2025-12-31",
      durationDays: null,
      frame: "CY2025Q4I",
    });
  });

  it.each([
    null,
    [],
    { cik: 7, facts: {} },
    { cik: 42, facts: null },
    { cik: 42, facts: { "us-gaap": [] } },
    { cik: 42, facts: { "us-gaap": null } },
  ])(
    "rejects the invalid shared issuer or taxonomy envelope %j with its typed error",
    (value) => {
      try {
        normalizePersonalSecAnnualStatementCompanyFacts(
          parsePersonalSecSourceJson(JSON.stringify(value)),
          CIK,
          ACCESSION,
        );
        throw new Error("Expected an invalid shared envelope");
      } catch (error) {
        expect(error).toBeInstanceOf(PersonalSecSourceError);
        expect((error as PersonalSecSourceError).status).toBe(
          "invalid_response",
        );
      }
    },
  );

  it.each([
    [undefined, "concept_missing"],
    [{ units: { EUR: [fact()] } }, "usd_missing"],
    [usd([]), "empty_usd"],
  ] as const)(
    "keeps exact absence %s without fake zero observations",
    (entry, absence) => {
      const result = normalize({ Revenues: entry, [OCF]: usd() });
      expect(scan(result, "Revenues")).toEqual({
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
      expect(rows(result, "Revenues")).toEqual([]);
      expect(rows(result, OCF)).toHaveLength(1);
    },
  );

  it.each([
    null,
    [],
    {},
    { units: [] },
    { units: { USD: null } },
    { units: { USD: {} } },
  ])("withholds only the malformed concept %j", (entry) => {
    const result = normalize({ Revenues: entry, [OCF]: usd() });
    expect(scan(result, "Revenues")).toEqual({
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    expect(rows(result, OCF)).toHaveLength(1);
  });

  it("deduplicates normalized identical values but retains conflicts and the first original source pointer", () => {
    const result = normalize(
      {
        [OCF]: usd([
          null,
          fact({ val: "__number_0__" }),
          fact({ val: "__number_1__" }),
          fact({ val: 101 }),
          fact({ frame: "CY2025" }),
          fact({ val: "100" }),
          fact({ accn: OTHER }),
        ]),
      },
      ACCESSION,
      ["100.00", "1e2"],
    );
    expect(scan(result, OCF)).toEqual({
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 7,
          inspectedRows: 7,
          invalidRows: 2,
          duplicateRows: 1,
          uniqueObservations: 4,
        },
        selected: 3,
        otherAccessions: 1,
        returned: 3,
        omittedSelected: 0,
      },
    });
    const selected = rows(result, OCF);
    expect(selected.map((row) => row.value).sort()).toEqual([
      "100",
      "100",
      "101",
    ]);
    expect(
      selected.find((row) => row.value === "100" && row.frame === null)!
        .sourceLocator,
    ).toBe(`/facts/us-gaap/${OCF}/units/USD/1`);
    expect(
      selected.find((row) => row.value === "100" && row.frame === null)!.id,
    ).toBe(
      `sec-fact:${createHash("sha256")
        .update(
          JSON.stringify([
            "sec-annual-statement-fact",
            "1.0.0",
            "us-gaap",
            OCF,
            "USD",
            "100",
            "2025-01-01",
            "2025-12-31",
            365,
            "unresolved",
            2025,
            "FY",
            null,
            ACCESSION,
            "10-K",
            "2026-02-01",
          ]),
        )
        .digest("hex")}`,
    );
    expect(new Set(selected.map((row) => row.id)).size).toBe(3);
  });

  it("counts invalid source metadata without changing concept absence or hiding valid siblings", () => {
    const invalid = [
      fact({ end: "2025-02-30" }),
      fact({ start: "2026-01-01" }),
      fact({ accn: "not-an-accession" }),
      fact({ form: "" }),
      fact({ filed: "2026-02-30" }),
      fact({ fy: "2025" }),
      fact({ fp: " FY" }),
      fact({ frame: "bad\nframe" }),
      fact({ val: "100" }),
    ];
    const result = normalize({ Revenues: usd(invalid), [OCF]: usd() });
    expect(scan(result, "Revenues")).toEqual({
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 9,
          inspectedRows: 9,
          invalidRows: 9,
          duplicateRows: 0,
          uniqueObservations: 0,
        },
        selected: 0,
        otherAccessions: 0,
        returned: 0,
        omittedSelected: 0,
      },
    });
    expect(rows(result, "Revenues")).toEqual([]);
    expect(rows(result, OCF)).toHaveLength(1);
  });

  it("sorts complete source rows within registry groups while preserving annual-ineligible rows for later admission", () => {
    const result = normalize({
      [OCF]: usd([
        fact({ end: "2024-12-31", start: "2024-01-01", val: 1 }),
        fact({ val: 2 }),
        fact({ start: "2025-10-01", fp: "Q4", val: 3 }),
        fact({ val: 4, filed: "2026-02-02", form: "10-K/A" }),
      ]),
      Revenues: usd([fact({ end: "2023-12-31", start: "2023-01-01" })]),
    });
    expect(result.observations[0]!.concept).toBe("Revenues");
    expect(rows(result, OCF).map((row) => row.value)).toEqual([
      "3",
      "4",
      "2",
      "1",
    ]);
    expect(rows(result, OCF)[0]).toMatchObject({
      filingFocusPeriod: "Q4",
      durationDays: 92,
    });
    expect(rows(result, OCF)[1]!.form).toBe("10-K/A");
    expect(scan(result, OCF)).toMatchObject({
      coverage: { full: { invalidRows: 0 }, selected: 4 },
    });
  });

  it("filters only the exact selected accession and returns no rows or inferred counts for an unresolved target", () => {
    const taxonomy = {
      [OCF]: usd([
        fact(),
        fact({ accn: OTHER, val: 200 }),
        fact({ val: "invalid" }),
      ]),
    };
    const selected = normalize(taxonomy, OTHER);
    expect(rows(selected, OCF).map((row) => row.value)).toEqual(["200"]);
    expect(scan(selected, OCF)).toMatchObject({
      coverage: {
        full: { candidateRows: 3, invalidRows: 1, uniqueObservations: 2 },
        selected: 1,
        otherAccessions: 1,
        returned: 1,
      },
    });
    const unresolved = normalize(taxonomy, null);
    expect(unresolved.observations).toEqual([]);
    expect(scan(unresolved, OCF)).toMatchObject({
      coverage: {
        full: {
          candidateRows: 3,
          inspectedRows: 3,
          invalidRows: 1,
          uniqueObservations: 2,
        },
        selected: null,
        otherAccessions: null,
        returned: 0,
        omittedSelected: null,
      },
    });
    expect(
      rows(normalize({ [OCF]: usd([fact({ accn: OTHER })]) }), OCF),
    ).toEqual([]);
  });

  it("withholds all 101 selected rows of one concept without hiding valid siblings or clipping its coverage", () => {
    const selected = Array.from({ length: 101 }, (_, val) =>
      fact({ val, fp: "Q4", start: "2025-10-01" }),
    );
    const atCap = normalize({ [OCF]: usd(selected.slice(0, 100)) });
    expect(rows(atCap, OCF)).toHaveLength(100);
    const result = normalize({
      [OCF]: usd([...selected, fact({ accn: OTHER })]),
      StockholdersEquity: usd([fact({ start: undefined, val: -20 })]),
    });
    expect(rows(result, OCF)).toEqual([]);
    expect(scan(result, OCF)).toMatchObject({
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 102,
          inspectedRows: 102,
          invalidRows: 0,
          uniqueObservations: 102,
        },
        selected: 101,
        otherAccessions: 1,
        returned: 0,
        omittedSelected: 101,
      },
    });
    expect(rows(result, "StockholdersEquity")).toHaveLength(1);
  });

  it("counts 10000 candidates completely for each concept in the same source", () => {
    const candidates = Array.from({ length: 10_000 }, () => fact());
    const result = normalize({
      Revenues: usd(candidates),
      [OCF]: usd(candidates),
    });
    for (const concept of ["Revenues", OCF] as const)
      expect(scan(result, concept)).toMatchObject({
        status: "available",
        coverage: {
          full: {
            candidateRows: 10_000,
            inspectedRows: 10_000,
            invalidRows: 0,
            duplicateRows: 9_999,
            uniqueObservations: 1,
          },
          returned: 1,
        },
      });
  });

  it("refuses candidate overflow without claiming inspection or hiding a valid sibling", () => {
    const candidates = Array.from({ length: 10_001 }, () => fact());
    const overflow = normalize({
      Revenues: usd(candidates),
      [OCF]: usd(),
    });
    expect(scan(overflow, "Revenues")).toEqual({
      status: "candidate_limit",
      absence: null,
      coverage: null,
    });
    expect(rows(overflow, "Revenues")).toEqual([]);
    expect(rows(overflow, OCF)).toHaveLength(1);
  });

  it("retains the complete derived global bound of 3200 rows without an additional shared concept budget", () => {
    const result = normalize(
      Object.fromEntries(
        PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => [
          entry.concept,
          usd(
            Array.from({ length: 100 }, (_, val) =>
              fact({
                val,
                start:
                  entry.periodType === "instant" ? undefined : "2025-01-01",
              }),
            ),
          ),
        ]),
      ),
    );
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS.observations).toBe(3200);
    expect(result.observations).toHaveLength(3200);
    expect(new Set(result.observations.map((row) => row.id)).size).toBe(3200);
    for (const item of result.scans)
      expect(item.scan).toMatchObject({
        status: "available",
        coverage: { selected: 100, returned: 100, omittedSelected: 0 },
      });
  });

  it("ignores unregistered concepts, custom taxonomy and IFRS without substituting USD units or revenue bases", () => {
    const raw = parsePersonalSecSourceJson(
      JSON.stringify({
        cik: "42",
        facts: {
          "us-gaap": {
            Revenues: { units: { EUR: [fact()] } },
            CostOfGoodsAndServicesSold: usd(),
            ProfitLoss: usd(),
            CustomRevenue: usd(),
          },
          "ifrs-full": { Revenue: usd(), NetIncomeLoss: usd() },
          custom: { Revenues: usd() },
        },
      }),
    );
    const result = normalizePersonalSecAnnualStatementCompanyFacts(
      raw,
      CIK,
      ACCESSION,
    );
    expect(result.observations).toEqual([]);
    expect(scan(result, "Revenues")).toMatchObject({ absence: "usd_missing" });
    expect(scan(result, "CostOfRevenue")).toMatchObject({
      absence: "concept_missing",
    });
    expect(scan(result, "NetIncomeLoss")).toMatchObject({
      absence: "concept_missing",
    });
    const nonUsGaap = normalizePersonalSecAnnualStatementCompanyFacts(
      parsePersonalSecSourceJson(
        '{"cik":42,"facts":{"ifrs-full":{"Revenue":{"units":{"USD":[]}}}}}',
      ),
      CIK,
      ACCESSION,
    );
    expect(nonUsGaap.scans).toHaveLength(32);
    expect(
      nonUsGaap.scans.every(
        (item) =>
          item.scan.status === "available" &&
          item.scan.absence === "concept_missing",
      ),
    ).toBe(true);
  });
});
