import type {
  PersonalFinancialScreenClauseDto,
  PersonalFinancialScreenCriteriaDto,
  PersonalFinancialScreenMetricDto,
  PersonalSecAnnualConceptDto,
  PersonalSecAnnualFactDto,
  PersonalSecAnnualFinancialSnapshotDto,
  PersonalSecAnnualFrameDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_SCREEN_FORMULAS,
  evaluatePersonalFinancialScreen,
  validatePersonalFinancialScreenCriteria,
} from "./index";

const CATALOG_DIGEST = `sha256:${"a".repeat(64)}` as const;
const FINANCIAL_DIGEST = `sha256:${"b".repeat(64)}` as const;
const REVENUE = "RevenueFromContractWithCustomerExcludingAssessedTax";
const CONCEPTS: readonly PersonalSecAnnualConceptDto[] = [
  REVENUE,
  "Revenues",
  "SalesRevenueNet",
  "NetIncomeLoss",
  "OperatingIncomeLoss",
  "NetCashProvidedByUsedInOperatingActivities",
];

describe("SEC annual financial screener", () => {
  it("preserves full-dollar precision, computes shared margin definitions, and exposes source durations", () => {
    const company = identity("ALPHA", 1);
    const result = run(
      [company],
      snapshot({
        [REVENUE]: [fact(1, "300000000000000000000.00")],
        Revenues: [
          fact(1, "300000000000000000000", {
            accessionNumber: "0000000001-26-000002",
          }),
        ],
        NetIncomeLoss: [fact(1, "100000000000000000000")],
        OperatingIncomeLoss: [fact(1, "50000000000000000000")],
        NetCashProvidedByUsedInOperatingActivities: [
          fact(1, "-10000000000000000000"),
        ],
      }),
    );
    const metrics = result.rows[0]!.metrics;
    expect(metrics.revenue).toMatchObject({
      status: "available",
      value: "300000000000000000000",
      unit: "USD",
    });
    expect(metrics.revenue.sources).toHaveLength(2);
    expect(metrics.netMargin).toMatchObject({
      status: "available",
      value: "33.33",
      unit: "percent",
    });
    expect(metrics.operatingMargin).toMatchObject({
      status: "available",
      value: "16.67",
    });
    expect(metrics.operatingCashFlowMargin).toMatchObject({
      status: "available",
      value: "-3.33",
    });
    expect(metrics.netMargin.sources).toContainEqual({
      concept: "NetIncomeLoss",
      accessionNumber: "0000000001-26-000001",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      value: "100000000000000000000",
    });
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.netMargin).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.netMargin,
    );
    expect(result).toMatchObject({
      calendarYear: 2025,
      formulaVersion: "1.0.0",
      catalogSnapshotSha256: CATALOG_DIGEST,
      financialSnapshotSha256: FINANCIAL_DIGEST,
    });
    expect(result.rows[0]).not.toHaveProperty("fiscalYear");
  });

  it("rounds halfway away from zero and normalizes negative zero", () => {
    const result = run(
      [identity("ROUND", 1)],
      snapshot({
        [REVENUE]: [fact(1, "100")],
        NetIncomeLoss: [fact(1, "1.005")],
        OperatingIncomeLoss: [fact(1, "-1.005")],
        NetCashProvidedByUsedInOperatingActivities: [fact(1, "-0.000001")],
      }),
    );
    expect(result.rows[0]!.metrics.netMargin).toMatchObject({ value: "1.01" });
    expect(result.rows[0]!.metrics.operatingMargin).toMatchObject({
      value: "-1.01",
    });
    expect(result.rows[0]!.metrics.operatingCashFlowMargin).toMatchObject({
      value: "0.00",
    });
  });

  it.each([
    { value: "101" },
    { startDate: "2024-12-31" },
    { endDate: "2025-12-30" },
  ])(
    "makes conflicting revenue aliases unknown when %j differs",
    (difference) => {
      const input = snapshot({
        [REVENUE]: [fact(1, "100")],
        Revenues: [fact(1, "100", difference)],
      });
      const displayed = run([identity("CONFLICT", 1)], input);
      expect(displayed.rows[0]!.metrics.revenue).toMatchObject({
        status: "unavailable",
        reason: "conflicting",
      });
      const filtered = run(
        [identity("CONFLICT", 1)],
        input,
        criteria([clause("revenue", "gte", "0")]),
      );
      expect(filtered).toMatchObject({
        totalMatches: 0,
        totalUnknown: 1,
        totalNonMatches: 0,
      });
    },
  );

  it("does not hide ambiguous CIK entries or failed revenue aliases behind a usable alias", () => {
    const base = snapshot({ [REVENUE]: [fact(1, "100")] });
    const ambiguous = replaceFrame(base, "Revenues", { unknownCiks: [cik(1)] });
    expect(
      run([identity("AMBIG", 1)], ambiguous).rows[0]!.metrics.revenue,
    ).toMatchObject({ status: "unavailable", reason: "conflicting" });
    const failed = replaceFrame(base, "SalesRevenueNet", {
      status: "upstream_unavailable",
    });
    const metrics = run([identity("FAILED", 1)], failed).rows[0]!.metrics;
    expect(metrics.revenue).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    expect(metrics.netMargin).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    const uncovered = replaceFrame(base, "SalesRevenueNet", {
      status: "not_covered",
    });
    expect(
      run([identity("EMPTY", 1)], uncovered).rows[0]!.metrics.revenue,
    ).toMatchObject({ status: "available", value: "100" });
  });

  it("requires the same exact duration for a ratio while preserving the reported amounts", () => {
    const result = run(
      [identity("PERIOD", 1)],
      snapshot({
        [REVENUE]: [fact(1, "100")],
        NetIncomeLoss: [
          fact(1, "10", { startDate: "2024-12-30", endDate: "2025-12-28" }),
        ],
        OperatingIncomeLoss: [fact(1, "20")],
      }),
    );
    expect(result.rows[0]!.metrics.netIncome).toMatchObject({
      status: "available",
      value: "10",
    });
    expect(result.rows[0]!.metrics.netMargin).toMatchObject({
      status: "unavailable",
      reason: "period_mismatch",
    });
    expect(result.rows[0]!.metrics.operatingMargin).toMatchObject({
      status: "available",
      value: "20.00",
    });
  });

  it.each(["0", "-100"])(
    "preserves %s revenue but makes margins unavailable",
    (revenue) => {
      const result = run(
        [identity("NONPOS", 1)],
        snapshot({
          [REVENUE]: [fact(1, revenue)],
          NetIncomeLoss: [fact(1, "10")],
        }),
      );
      expect(result.rows[0]!.metrics.revenue).toMatchObject({
        status: "available",
        value: revenue,
      });
      expect(result.rows[0]!.metrics.netMargin).toMatchObject({
        status: "unavailable",
        reason: "nonpositive_revenue",
      });
    },
  );

  it("treats missing and invalid values as unknown, never as zero", () => {
    const result = run(
      [identity("MISSING", 1), identity("INVALID", 2)],
      snapshot({
        [REVENUE]: [fact(2, "NaN")],
      }),
      criteria([clause("revenue", "lte", "0")]),
    );
    expect(result).toMatchObject({
      totalMatches: 0,
      totalNonMatches: 0,
      totalUnknown: 2,
    });
    expect(result.metricCoverage.revenue).toEqual({ known: 0, unknown: 2 });
    const all = run(
      [identity("INVALID", 2)],
      snapshot({ [REVENUE]: [fact(2, "NaN")] }),
    );
    expect(all.rows[0]!.metrics.revenue).toMatchObject({
      status: "unavailable",
      reason: "invalid_value",
    });
  });

  it("uses false-dominates-unknown AND semantics independent of clause order", () => {
    const companies = [
      identity("PASS", 1),
      identity("FAIL", 2),
      identity("UNKNOWN", 3),
    ];
    const data = snapshot({
      [REVENUE]: [fact(1, "200"), fact(2, "20"), fact(3, "300")],
      NetIncomeLoss: [fact(1, "30")],
    });
    const clauses = [
      clause("netIncome", "gte", "10"),
      clause("revenue", "gte", "100"),
    ];
    for (const filters of [clauses, [...clauses].reverse()]) {
      const result = run(companies, data, criteria(filters));
      expect(result.rows.map((row) => row.identity.symbol)).toEqual(["PASS"]);
      expect(result).toMatchObject({
        identityMatches: 3,
        totalMatches: 1,
        totalNonMatches: 1,
        totalUnknown: 1,
      });
      expect(
        result.totalMatches + result.totalNonMatches + result.totalUnknown,
      ).toBe(result.identityMatches);
    }
  });

  it("counts coverage across the identity-filtered cohort, including nonmatches and unknowns", () => {
    const companies = [
      identity("ALPHA", 1, "Café Group"),
      identity("BETA", 2, "Cafe Group"),
      identity("OTHER", 3),
    ];
    const result = run(
      companies,
      snapshot({
        [REVENUE]: [fact(1, "100"), fact(2, "20"), fact(3, "1000")],
        NetIncomeLoss: [fact(1, "10")],
      }),
      {
        ...criteria([clause("revenue", "gte", "50")]),
        identityText: "cafe group",
      },
    );
    expect(result).toMatchObject({
      totalUniverse: 3,
      identityMatches: 2,
      totalMatches: 1,
      totalNonMatches: 1,
      totalUnknown: 0,
    });
    expect(result.metricCoverage.revenue).toEqual({ known: 2, unknown: 0 });
    expect(result.metricCoverage.netIncome).toEqual({ known: 1, unknown: 1 });
    expect(result.metricCoverage.operatingIncome).toEqual({
      known: 0,
      unknown: 2,
    });
  });

  it("includes unavailable rows without numerical clauses and places them last in either numeric sort direction", () => {
    const companies = [
      identity("UNKNOWN", 1),
      identity("BIG", 2),
      identity("SMALL", 3),
      identity("ALSO", 4),
    ];
    const data = snapshot({
      [REVENUE]: [
        fact(2, "9007199254740993"),
        fact(3, "9007199254740992"),
        fact(4, "9007199254740993"),
      ],
    });
    const ascending = run(companies, data, {
      ...criteria(),
      sort: { field: "revenue", direction: "asc" },
    });
    const descending = run(companies, data, {
      ...criteria(),
      sort: { field: "revenue", direction: "desc" },
    });
    expect(ascending.rows.map((row) => row.identity.symbol)).toEqual([
      "SMALL",
      "ALSO",
      "BIG",
      "UNKNOWN",
    ]);
    expect(descending.rows.map((row) => row.identity.symbol)).toEqual([
      "ALSO",
      "BIG",
      "SMALL",
      "UNKNOWN",
    ]);
    expect(descending).toMatchObject({
      totalMatches: 4,
      totalUnknown: 0,
      totalNonMatches: 0,
    });
    expect(descending.metricCoverage.revenue).toEqual({ known: 3, unknown: 1 });
  });

  it("breaks ties by listing identity and keeps page boundaries stable after input reordering", () => {
    const first = identity("SAME", 1);
    const second = {
      ...identity("SAME", 1),
      listingId: "listing-0000000001-b",
    };
    const companies = [second, identity("ZED", 2), first];
    const data = snapshot({ [REVENUE]: [fact(1, "100"), fact(2, "100")] });
    const filters = {
      ...criteria(),
      sort: { field: "revenue", direction: "desc" } as const,
    };
    const page1 = run(companies, data, filters, { offset: 0, limit: 1 });
    const page2 = run([...companies].reverse(), data, filters, {
      offset: 1,
      limit: 1,
    });
    expect(page1.rows[0]!.identity.listingId).toBe(first.listingId);
    expect(page2.rows[0]!.identity.listingId).toBe(second.listingId);
    expect(page1.hasMore).toBe(true);
    expect(page2.metricCoverage.revenue).toEqual({ known: 3, unknown: 0 });
    expect(run(companies, data, filters, { offset: 2, limit: 1 }).hasMore).toBe(
      false,
    );
    expect(
      run(companies, data, filters, { offset: 99, limit: 1 }),
    ).toMatchObject({ rows: [], hasMore: false, totalMatches: 3 });
  });

  it("produces deterministic source order without mutating inputs", () => {
    const facts = [
      fact(1, "100", { accessionNumber: "0000000001-26-000003" }),
      fact(1, "100"),
    ];
    const input = snapshot({ [REVENUE]: facts });
    const before = JSON.stringify(input);
    const result = run([identity("ORDER", 1)], input);
    const reordered = run([identity("ORDER", 1)], {
      ...input,
      frames: [...input.frames]
        .reverse()
        .map((frame) => ({ ...frame, facts: [...frame.facts].reverse() })),
    });
    expect(reordered).toEqual(result);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("supports inclusive decimal thresholds, bounded ranges, and no matching identities", () => {
    const data = snapshot({ [REVENUE]: [fact(1, "100.01")] });
    const result = run(
      [identity("EDGE", 1)],
      data,
      criteria([
        clause("revenue", "gte", "100.01"),
        clause("revenue", "lte", "100.01"),
      ]),
    );
    expect(result.totalMatches).toBe(1);
    const empty = run([identity("EDGE", 1)], data, {
      ...criteria(),
      identityText: "no-such-company",
    });
    expect(empty).toMatchObject({
      identityMatches: 0,
      totalMatches: 0,
      totalNonMatches: 0,
      totalUnknown: 0,
      rows: [],
      hasMore: false,
    });
    expect(empty.metricCoverage.revenue).toEqual({ known: 0, unknown: 0 });
  });
});

describe("financial-screen grammar and boundary validation", () => {
  it.each([
    { ...criteria(), calendarYear: 2008 },
    { ...criteria(), calendarYear: 2101 },
    { ...criteria(), calendarYear: 2025.5 },
    { ...criteria(), identityText: "a".repeat(121) },
    { ...criteria(), identityText: "secret\ntext" },
    {
      ...criteria(),
      clauses: [{ field: "arbitrary_sql", operator: "gte", value: "1" }],
    },
    {
      ...criteria(),
      clauses: [{ field: "revenue", operator: "equals", value: "1" }],
    },
    {
      ...criteria(),
      clauses: [{ field: "revenue", operator: "gte", value: 1 }],
    },
    {
      ...criteria(),
      clauses: [{ field: "revenue", operator: "gte", value: "1e6" }],
    },
    {
      ...criteria(),
      clauses: [{ field: "revenue", operator: "gte", value: "NaN" }],
    },
    {
      ...criteria(),
      clauses: Array.from({ length: 8 }, () => clause("revenue", "gte", "1")),
    },
    { ...criteria(), sort: { field: "unregistered", direction: "asc" } },
    { ...criteria(), schemaVersion: "unexpected" },
    null,
  ])("rejects invalid criteria without leaking its contents", (value) => {
    expect(validatePersonalFinancialScreenCriteria(value)).toBe(false);
    expect(() =>
      run([], snapshot(), value as PersonalFinancialScreenCriteriaDto),
    ).toThrow("Personal financial screen request is invalid.");
  });

  it("accepts the public limits and rejects accessors without executing them", () => {
    expect(
      validatePersonalFinancialScreenCriteria({
        ...criteria(),
        calendarYear: 2009,
      }),
    ).toBe(true);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...criteria(),
        calendarYear: 2100,
        clauses: Array.from({ length: 7 }, () => clause("revenue", "lte", "0")),
      }),
    ).toBe(true);
    let invoked = false;
    const unsafe = {
      ...criteria(),
      get identityText() {
        invoked = true;
        return "unsafe";
      },
    };
    expect(validatePersonalFinancialScreenCriteria(unsafe)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("rejects invalid pages, mismatched years, duplicate identities, and corrupted snapshot metadata", () => {
    for (const page of [
      { offset: -1, limit: 1 },
      { offset: 0, limit: 251 },
      { offset: 0.5, limit: 1 },
      { offset: 10_001, limit: 1 },
    ]) {
      expect(() => run([], snapshot(), criteria(), page)).toThrow(
        "Personal financial screen request is invalid.",
      );
    }
    expect(() =>
      run([], snapshot(), { ...criteria(), calendarYear: 2024 }),
    ).toThrow();
    expect(() =>
      run([identity("DUP", 1), identity("DUP", 1)], snapshot()),
    ).toThrow();
    expect(() =>
      run(
        Array.from({ length: 10_001 }, (_, index) =>
          identity(`S${index}`, index + 1),
        ),
        snapshot(),
      ),
    ).toThrow();
    expect(() =>
      run([], { ...snapshot(), snapshotSha256: "sha256:bad" }),
    ).toThrow();
    expect(() =>
      run([], { ...snapshot(), expiresAt: "2026-09-09T11:00:00Z" }),
    ).toThrow();
    expect(() =>
      run([], { ...snapshot(), frames: snapshot().frames.slice(1) }),
    ).toThrow();
    expect(() =>
      run(
        [],
        replaceFrame(snapshot(), REVENUE, {
          sourceUrl: "https://attacker.invalid/private",
        }),
      ),
    ).toThrow();
    expect(() =>
      run(
        [],
        snapshot({ [REVENUE]: [fact(1, "1", { endDate: "2025-02-30" })] }),
      ),
    ).toThrow();
  });
});

function run(
  identities: readonly PersonalSecurityMasterScreenRowDto[],
  input: PersonalSecAnnualFinancialSnapshotDto,
  filters = criteria(),
  page = { offset: 0, limit: 250 },
) {
  return evaluatePersonalFinancialScreen(
    identities,
    input,
    filters,
    page,
    CATALOG_DIGEST,
  );
}

function criteria(
  clauses: readonly PersonalFinancialScreenClauseDto[] = [],
): PersonalFinancialScreenCriteriaDto {
  return {
    calendarYear: 2025,
    identityText: "",
    clauses,
    sort: { field: "symbol", direction: "asc" },
  };
}

function clause(
  field: PersonalFinancialScreenMetricDto,
  operator: "gte" | "lte",
  value: string,
): PersonalFinancialScreenClauseDto {
  return { field, operator, value };
}

function cik(index: number): string {
  return String(index).padStart(10, "0");
}

function identity(
  symbol: string,
  index: number,
  issuerName = `Issuer ${String(index)}`,
): PersonalSecurityMasterScreenRowDto {
  const id = cik(index);
  return {
    cik: id,
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${id}`,
    issuerName,
    listingId: `listing-${id}`,
    securityId: `security-${id}`,
    securityName: `${issuerName} Common Stock`,
    shareClassId: `share-class-${id}`,
    shareClassName: "Common Stock",
    symbol,
  };
}

function fact(
  index: number,
  value: string,
  overrides: Partial<PersonalSecAnnualFactDto> = {},
): PersonalSecAnnualFactDto {
  return {
    cik: cik(index),
    accessionNumber: `${cik(index)}-26-000001`,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    value,
    ...overrides,
  };
}

function snapshot(
  values: Partial<
    Record<PersonalSecAnnualConceptDto, readonly PersonalSecAnnualFactDto[]>
  > = {},
): PersonalSecAnnualFinancialSnapshotDto {
  return {
    calendarYear: 2025,
    fetchedAt: "2026-09-09T12:00:00Z",
    expiresAt: "2026-09-09T12:30:00Z",
    snapshotSha256: FINANCIAL_DIGEST,
    frames: CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
      facts: values[concept] ?? [],
      unknownCiks: [],
    })),
  };
}

function replaceFrame(
  input: PersonalSecAnnualFinancialSnapshotDto,
  concept: PersonalSecAnnualConceptDto,
  overrides: Partial<PersonalSecAnnualFrameDto>,
): PersonalSecAnnualFinancialSnapshotDto {
  return {
    ...input,
    frames: input.frames.map((frame) =>
      frame.concept === concept ? { ...frame, ...overrides } : frame,
    ),
  };
}
