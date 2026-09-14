import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialScreenClauseDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalSecAnnualConceptDto,
  type PersonalSecAnnualFactDto,
  type PersonalSecAnnualFinancialSnapshotDto,
  type PersonalSecAnnualFrameDto,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_SCREEN_FORMULAS,
  PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION,
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
  "GrossProfit",
  "PaymentsToAcquirePropertyPlantAndEquipment",
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
      formulaVersion: "1.1.0",
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
    "keeps the original agreement check unavailable when revenue observations differ by %j",
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

  it("keeps ambiguous CIK entries and failed revenue concepts unavailable under the original agreement check", () => {
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

describe("reported gross profit screening", () => {
  it("retains the original metric and acquisition positions in the expanded transport", () => {
    const result = run([identity("REPORTED", 1)], snapshot());
    const metrics = [
      "revenue",
      "grossProfit",
      "netIncome",
      "operatingIncome",
      "operatingCashFlow",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
    ];
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toEqual(metrics);
    expect(Object.keys(result.rows[0]!.metrics)).toEqual(metrics);
    expect(Object.keys(result.metricCoverage)).toEqual(metrics);
    expect(PERSONAL_SEC_ANNUAL_CONCEPTS).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
      "GrossProfit",
      "PaymentsToAcquirePropertyPlantAndEquipment",
    ]);
    expect(result).toMatchObject({
      schemaVersion: "3.0.0",
      formulaVersion: "1.1.0",
    });
    expect(() =>
      run([], { ...snapshot(), frames: snapshot().frames.slice(0, 7) }),
    ).toThrow("Personal financial screen request is invalid.");
  });

  it.each([
    "123456789012345678901234567890123456789012345678901234567890.345",
    "-9007199254740993.00000000000000001",
    "0",
  ])(
    "preserves the exact reported USD amount %s and its own duration",
    (value) => {
      const grossProfit = fact(1, value, {
        accessionNumber: "0000000001-26-000007",
        startDate: "2025-02-01",
        endDate: "2026-01-31",
      });
      const result = run(
        [identity("AMOUNT", 1)],
        snapshot({ [REVENUE]: [fact(1, "100")], GrossProfit: [grossProfit] }),
      );
      expect(result.rows[0]!.metrics.grossProfit).toEqual({
        status: "available",
        unit: "USD",
        value,
        sources: [
          {
            concept: "GrossProfit",
            accessionNumber: grossProfit.accessionNumber,
            startDate: grossProfit.startDate,
            endDate: grossProfit.endDate,
            value,
          },
        ],
      });
      expect(result.metricCoverage.grossProfit).toEqual({
        known: 1,
        unknown: 0,
      });
      expect(result.rows[0]!.metrics).not.toHaveProperty("grossMargin");
    },
  );

  it.each([
    ["absent", {}, "missing"],
    ["not covered", { status: "not_covered" }, "missing"],
    ["rate limited", { status: "rate_limited" }, "source_unavailable"],
    [
      "upstream failure",
      { status: "upstream_unavailable" },
      "source_unavailable",
    ],
    ["invalid response", { status: "invalid_response" }, "source_unavailable"],
    ["ambiguous CIK", { unknownCiks: [cik(1)] }, "conflicting"],
    ["invalid decimal", { facts: [fact(1, "1e9")] }, "invalid_value"],
    [
      "different amount",
      { facts: [fact(1, "20"), fact(1, "21")] },
      "conflicting",
    ],
    [
      "different start",
      { facts: [fact(1, "20"), fact(1, "20", { startDate: "2025-01-02" })] },
      "conflicting",
    ],
    [
      "different end",
      { facts: [fact(1, "20"), fact(1, "20", { endDate: "2025-12-30" })] },
      "conflicting",
    ],
  ] satisfies readonly (readonly [
    string,
    Partial<PersonalSecAnnualFrameDto>,
    string,
  ])[])(
    "keeps %s gross profit unknown without affecting other reported amounts or margins",
    (_label, overrides, reason) => {
      const result = run(
        [identity("UNKNOWN", 1)],
        replaceFrame(
          snapshot({
            [REVENUE]: [fact(1, "100")],
            NetIncomeLoss: [fact(1, "10")],
            OperatingIncomeLoss: [fact(1, "20")],
            NetCashProvidedByUsedInOperatingActivities: [fact(1, "30")],
            PaymentsToAcquirePropertyPlantAndEquipment: [fact(1, "5")],
          }),
          "GrossProfit",
          overrides,
        ),
      );
      expect(result.rows[0]!.metrics.grossProfit).toMatchObject({
        status: "unavailable",
        unit: "USD",
        reason,
      });
      expect(result.metricCoverage.grossProfit).toEqual({
        known: 0,
        unknown: 1,
      });
      for (const [metric, cell] of Object.entries(result.rows[0]!.metrics))
        if (metric !== "grossProfit") expect(cell.status).toBe("available");
    },
  );

  it("retains equivalent observations and every source reference without preferring an accession", () => {
    const data = snapshot({
      GrossProfit: [
        fact(1, "12.500", { accessionNumber: "0000000001-26-000002" }),
        fact(1, "12.5"),
      ],
    });
    const before = JSON.stringify(data);
    const grossProfit = run([identity("SAME", 1)], data).rows[0]!.metrics
      .grossProfit;
    expect(grossProfit).toMatchObject({ status: "available", value: "12.5" });
    expect(grossProfit.sources.map((source) => source.accessionNumber)).toEqual(
      ["0000000001-26-000001", "0000000001-26-000002"],
    );
    expect(grossProfit.sources.map((source) => source.value)).toEqual([
      "12.5",
      "12.500",
    ]);
    expect(JSON.stringify(data)).toBe(before);
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "keeps gross profit independent of %s and unavailable, conflicting or nonpositive revenue",
    (revenueBasis) => {
      const scenarios = [
        snapshot({ GrossProfit: [fact(1, "-12.5")] }),
        snapshot({
          GrossProfit: [fact(1, "-12.5")],
          [REVENUE]: [fact(1, "100")],
          Revenues: [fact(1, "110")],
          SalesRevenueNet: [fact(1, "90")],
        }),
        snapshot({
          GrossProfit: [fact(1, "-12.5")],
          [REVENUE]: [fact(1, "0")],
          Revenues: [fact(1, "0")],
          SalesRevenueNet: [fact(1, "0")],
        }),
      ];
      scenarios.push(
        replaceFrame(scenarios[1]!, "Revenues", {
          status: "upstream_unavailable",
          facts: [],
        }),
      );
      for (const data of scenarios) {
        const result = run([identity("INDEPENDENT", 1)], data, {
          ...criteria([clause("grossProfit", "lte", "-12.5")]),
          revenueBasis,
        });
        expect(result.totalMatches).toBe(1);
        expect(result.rows[0]!.metrics.grossProfit).toEqual({
          status: "available",
          unit: "USD",
          value: "-12.5",
          sources: [
            {
              concept: "GrossProfit",
              accessionNumber: "0000000001-26-000001",
              startDate: "2025-01-01",
              endDate: "2025-12-31",
              value: "-12.5",
            },
          ],
        });
      }
    },
  );

  it("filters exact gross-profit thresholds with unknown and false-dominates-unknown counts", () => {
    const companies = [
      identity("NEGATIVE", 1),
      identity("ZERO", 2),
      identity("POSITIVE", 3),
      identity("MISSING", 4),
    ];
    const data = snapshot({
      GrossProfit: [
        fact(1, "-0.01"),
        fact(2, "0"),
        fact(3, "9007199254740993.01"),
      ],
      NetIncomeLoss: [fact(4, "-1")],
    });
    const result = run(
      companies,
      data,
      criteria([clause("grossProfit", "gte", "0")]),
    );
    expect(result).toMatchObject({
      identityMatches: 4,
      totalMatches: 2,
      totalNonMatches: 1,
      totalUnknown: 1,
    });
    expect(result.metricCoverage.grossProfit).toEqual({ known: 3, unknown: 1 });
    expect(
      run(
        companies,
        data,
        criteria([
          clause("grossProfit", "gte", "9007199254740993.01"),
          clause("grossProfit", "lte", "9007199254740993.01"),
        ]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["POSITIVE"]);
    for (const clauses of [
      [clause("grossProfit", "gte", "0"), clause("netIncome", "gte", "0")],
      [clause("netIncome", "gte", "0"), clause("grossProfit", "gte", "0")],
    ])
      expect(run(companies, data, criteria(clauses))).toMatchObject({
        totalMatches: 0,
        totalNonMatches: 2,
        totalUnknown: 2,
      });
  });

  it("sorts exact amounts, counts listings sharing a CIK and preserves paging with missing amounts last", () => {
    const companies = [
      identity("UNKNOWN", 1),
      identity("BIG", 2),
      identity("SMALL", 3),
      { ...identity("ALSO", 2), listingId: "listing-0000000002-b" },
    ];
    const data = snapshot({
      GrossProfit: [
        fact(2, "9007199254740993.01"),
        fact(3, "9007199254740993.00"),
      ],
    });
    for (const direction of ["asc", "desc"] as const) {
      const filters = {
        ...criteria(),
        sort: { field: "grossProfit", direction } as const,
      };
      const full = run(companies, data, filters);
      expect(full.rows.map((row) => row.identity.symbol)).toEqual(
        direction === "asc"
          ? ["SMALL", "ALSO", "BIG", "UNKNOWN"]
          : ["ALSO", "BIG", "SMALL", "UNKNOWN"],
      );
      const pages = [0, 2].map((offset) =>
        run([...companies].reverse(), data, filters, { offset, limit: 2 }),
      );
      expect(pages.flatMap((page) => page.rows)).toEqual(full.rows);
      expect(pages.map((page) => page.hasMore)).toEqual([true, false]);
      for (const page of pages)
        expect(page.metricCoverage.grossProfit).toEqual({
          known: 3,
          unknown: 1,
        });
    }
  });

  it("accepts literal legacy criteria unchanged and retains their old metric results when gross profit changes", () => {
    const legacyJson =
      '{"calendarYear":2025,"identityText":"LEGACY","clauses":[{"field":"revenue","operator":"gte","value":"100"},{"field":"netMargin","operator":"lte","value":"20"}],"sort":{"field":"operatingIncome","direction":"desc"}}';
    const legacy = JSON.parse(legacyJson) as PersonalFinancialScreenCriteriaDto;
    const data = snapshot({
      [REVENUE]: [fact(1, "100")],
      NetIncomeLoss: [fact(1, "10")],
      OperatingIncomeLoss: [fact(1, "20")],
      NetCashProvidedByUsedInOperatingActivities: [fact(1, "30")],
    });
    let original: unknown;
    for (const grossFrame of [
      {},
      { facts: [fact(1, "-50")] },
      { status: "upstream_unavailable", facts: [] },
    ] satisfies Partial<PersonalSecAnnualFrameDto>[]) {
      expect(validatePersonalFinancialScreenCriteria(legacy)).toBe(true);
      const result = run(
        [identity("LEGACY", 1)],
        replaceFrame(data, "GrossProfit", grossFrame),
        legacy,
      );
      expect(result).not.toHaveProperty("revenueBasis");
      expect(result.totalMatches).toBe(1);
      const oldMetrics = Object.fromEntries(
        Object.entries(result.rows[0]!.metrics).filter(
          ([metric]) => metric !== "grossProfit",
        ),
      );
      if (original === undefined) original = oldMetrics;
      else expect(oldMetrics).toEqual(original);
      expect(JSON.stringify(legacy)).toBe(legacyJson);
    }
    expect(
      validatePersonalFinancialScreenCriteria({
        ...legacy,
        clauses: Array.from({ length: 7 }, () =>
          clause("grossProfit", "gte", "0"),
        ),
        sort: { field: "grossProfit", direction: "asc" },
      }),
    ).toBe(true);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...legacy,
        clauses: Array.from({ length: 8 }, () =>
          clause("grossProfit", "gte", "0"),
        ),
      }),
    ).toBe(false);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...legacy,
        sort: { field: "grossMargin", direction: "asc" },
      }),
    ).toBe(false);
  });
});

describe("PP&E purchases and operating cash flow less PP&E purchases", () => {
  const ocf = "NetCashProvidedByUsedInOperatingActivities";
  const ppe = "PaymentsToAcquirePropertyPlantAndEquipment";
  const derived = "operatingCashFlowLessPpePurchases";

  it("versions only the screen formula set and keeps existing ratio metadata", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.1.0");
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[derived]).toEqual({
      formulaId: "operating_cash_flow_less_ppe_purchases",
      formulaVersion: "1.1.0",
      expression: "operating_cash_flow - ppe_purchases",
    });
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.netMargin).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.netMargin,
    );
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.netMargin.formulaVersion).toBe(
      "1.0.0",
    );
  });

  it.each([
    ["100.123456", "25.000001", "75.123455"],
    ["9007199254740993.01", "0.02", "9007199254740992.99"],
    ["-10", "2", "-12"],
    ["10", "12.25", "-2.25"],
    ["0", "0", "0"],
    ["-0.00", "0", "0"],
    ["2.0000001", "0.0000001", "2"],
  ])("subtracts %s less %s exactly as %s", (cashFlow, purchases, expected) => {
    const cells = run(
      [identity("EXACT", 1)],
      snapshot({
        [ocf]: [fact(1, cashFlow)],
        [ppe]: [fact(1, purchases)],
      }),
    ).rows[0]!.metrics;
    expect(cells.ppePurchases).toMatchObject({
      status: "available",
      unit: "USD",
    });
    expect(cells[derived]).toEqual({
      status: "available",
      unit: "USD",
      value: expected,
      sources: [
        ...cells.operatingCashFlow.sources,
        ...cells.ppePurchases.sources,
      ],
    });
  });

  it("preserves a negative reported purchase without silently reversing its sign", () => {
    const cells = run(
      [identity("SIGNED", 1)],
      snapshot({
        [ocf]: [fact(1, "10")],
        [ppe]: [fact(1, "-2")],
      }),
    ).rows[0]!.metrics;
    expect(cells.ppePurchases).toMatchObject({
      status: "available",
      value: "-2",
    });
    expect(cells[derived]).toEqual({
      status: "unavailable",
      unit: "USD",
      reason: "unsupported_sign",
      sources: [
        ...cells.operatingCashFlow.sources,
        ...cells.ppePurchases.sources,
      ],
    });
  });

  it.each([
    [{ startDate: "2025-01-02" }, "period_mismatch"],
    [{ endDate: "2025-12-30" }, "period_mismatch"],
    [{ accessionNumber: "0000000001-26-000002" }, "filing_mismatch"],
  ] as const)("keeps incompatible input %j unknown", (difference, reason) => {
    const cells = run(
      [identity("VINTAGE", 1)],
      snapshot({
        [ocf]: [fact(1, "10")],
        [ppe]: [fact(1, "2", difference)],
      }),
    ).rows[0]!.metrics;
    expect(cells.operatingCashFlow.status).toBe("available");
    expect(cells.ppePurchases.status).toBe("available");
    expect(cells[derived]).toEqual({
      status: "unavailable",
      unit: "USD",
      reason,
      sources: [
        ...cells.operatingCashFlow.sources,
        ...cells.ppePurchases.sources,
      ],
    });
  });

  it.each([ocf, ppe] as const)(
    "inspects every retained accession in %s",
    (concept) => {
      const data = snapshot({ [ocf]: [fact(1, "10")], [ppe]: [fact(1, "2")] });
      const first = data.frames.find((frame) => frame.concept === concept)!
        .facts[0]!;
      const cells = run(
        [identity("MULTIPLE", 1)],
        replaceFrame(data, concept, {
          facts: [first, { ...first, accessionNumber: "0000000001-26-000002" }],
        }),
      ).rows[0]!.metrics;
      expect(cells.operatingCashFlow.status).toBe("available");
      expect(cells.ppePurchases.status).toBe("available");
      expect(cells[derived]).toMatchObject({
        status: "unavailable",
        reason: "filing_mismatch",
      });
      expect(cells[derived].sources).toHaveLength(3);
    },
  );

  it.each([
    ["2025-11-30", false],
    ["2025-12-01", true],
    ["2026-01-30", true],
    ["2026-01-31", false],
  ] as const)(
    "requires an inclusive annual duration ending %s",
    (endDate, available) => {
      const cells = run(
        [identity("DURATION", 1)],
        snapshot({
          [ocf]: [fact(1, "10", { endDate })],
          [ppe]: [fact(1, "2", { endDate })],
        }),
      ).rows[0]!.metrics;
      expect(cells.operatingCashFlow.status).toBe("available");
      expect(cells.ppePurchases.status).toBe("available");
      expect(cells[derived]).toMatchObject(
        available
          ? { status: "available", value: "8" }
          : { status: "unavailable", reason: "period_mismatch" },
      );
    },
  );

  const unknownCases = [
    ["missing", { facts: [] }, "missing"],
    ["not covered", { status: "not_covered", facts: [] }, "missing"],
    ["rate limit", { status: "rate_limited", facts: [] }, "source_unavailable"],
    [
      "source failure",
      { status: "upstream_unavailable", facts: [] },
      "source_unavailable",
    ],
    [
      "invalid source",
      { status: "invalid_response", facts: [] },
      "source_unavailable",
    ],
    ["ambiguous issuer", { unknownCiks: [cik(1)] }, "conflicting"],
    ["invalid number", { facts: [fact(1, "1e2")] }, "invalid_value"],
    [
      "different amounts",
      { facts: [fact(1, "2"), fact(1, "3")] },
      "conflicting",
    ],
    [
      "different periods",
      { facts: [fact(1, "2"), fact(1, "2", { startDate: "2025-01-02" })] },
      "conflicting",
    ],
  ] satisfies readonly (readonly [
    string,
    Partial<PersonalSecAnnualFrameDto>,
    string,
  ])[];
  for (const concept of [ocf, ppe] as const) {
    it.each(unknownCases)(
      `propagates %s in ${concept} and retains the other operand`,
      (_label, changes, reason) => {
        const cells = run(
          [identity("UNKNOWN", 1)],
          replaceFrame(
            snapshot({
              [ocf]: [fact(1, "10")],
              [ppe]: [fact(1, "2")],
            }),
            concept,
            changes,
          ),
        ).rows[0]!.metrics;
        const other =
          concept === ocf ? cells.ppePurchases : cells.operatingCashFlow;
        expect(other.status).toBe("available");
        expect(cells[derived]).toEqual({
          status: "unavailable",
          unit: "USD",
          reason,
          sources: [
            ...cells.operatingCashFlow.sources,
            ...cells.ppePurchases.sources,
          ],
        });
      },
    );
  }

  it("applies deterministic operand, period, filing and sign precedence", () => {
    const base = snapshot({
      [ocf]: [fact(1, "10")],
      [ppe]: [
        fact(1, "-2", {
          startDate: "2025-01-02",
          accessionNumber: "0000000001-26-000002",
        }),
      ],
    });
    const cell = (data: PersonalSecAnnualFinancialSnapshotDto) =>
      run([identity("ORDER", 1)], data).rows[0]!.metrics[derived];
    expect(cell(base)).toMatchObject({ reason: "period_mismatch" });
    expect(
      cell(
        replaceFrame(base, ppe, {
          facts: [fact(1, "-2", { accessionNumber: "0000000001-26-000002" })],
        }),
      ),
    ).toMatchObject({ reason: "filing_mismatch" });
    expect(cell(replaceFrame(base, ocf, { facts: [] }))).toMatchObject({
      reason: "missing",
    });
    expect(
      cell(
        replaceFrame(replaceFrame(base, ocf, { facts: [] }), ppe, {
          status: "upstream_unavailable",
          facts: [],
        }),
      ),
    ).toMatchObject({ reason: "missing" });
  });

  it("preserves all old cells on PP&E failure and keeps both new fields independent of revenue basis", () => {
    const data = snapshot({
      [REVENUE]: [fact(1, "100")],
      Revenues: [fact(1, "120")],
      GrossProfit: [fact(1, "40")],
      NetIncomeLoss: [fact(1, "10")],
      OperatingIncomeLoss: [fact(1, "20")],
      [ocf]: [fact(1, "30")],
      [ppe]: [fact(1, "5")],
    });
    const baseline = run([identity("INDEPENDENT", 1)], data).rows[0]!.metrics;
    const failed = run(
      [identity("INDEPENDENT", 1)],
      replaceFrame(data, ppe, { status: "rate_limited", facts: [] }),
    ).rows[0]!.metrics;
    for (const metric of PERSONAL_FINANCIAL_SCREEN_METRICS.slice(0, 8))
      expect(failed[metric]).toEqual(baseline[metric]);
    for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
      const result = run([identity("INDEPENDENT", 1)], data, {
        ...criteria(),
        revenueBasis,
      });
      expect(result.rows[0]!.metrics.ppePurchases).toEqual(
        baseline.ppePurchases,
      );
      expect(result.rows[0]!.metrics[derived]).toEqual(baseline[derived]);
    }
  });

  it("reconciles signed thresholds, coverage and stable pages including two listings of one issuer", () => {
    const identities = [
      identity("ALPHA", 1),
      identity("BETA", 2),
      identity("GAMMA", 3),
      identity("UNKNOWN", 4),
      { ...identity("ALPHA.B", 1), listingId: "listing-alpha-b" },
    ];
    const data = snapshot({
      [ocf]: [fact(1, "20"), fact(2, "10"), fact(3, "-1")],
      [ppe]: [fact(1, "5"), fact(2, "15"), fact(3, "0")],
    });
    const positive = run(
      identities,
      data,
      criteria([clause(derived, "gte", "0")]),
    );
    expect(positive).toMatchObject({
      identityMatches: 5,
      totalMatches: 2,
      totalNonMatches: 2,
      totalUnknown: 1,
    });
    expect(positive.metricCoverage[derived]).toEqual({ known: 4, unknown: 1 });
    expect(positive.rows.map((row) => row.identity.symbol)).toEqual([
      "ALPHA",
      "ALPHA.B",
    ]);
    expect(
      run(identities, data, criteria([clause(derived, "gte", "-1")])),
    ).toMatchObject({ totalMatches: 3, totalNonMatches: 1, totalUnknown: 1 });
    for (const direction of ["asc", "desc"] as const) {
      const symbols: string[] = [];
      for (const offset of [0, 2, 4]) {
        const page = run(
          identities,
          data,
          { ...criteria(), sort: { field: derived, direction } },
          { offset, limit: 2 },
        );
        symbols.push(...page.rows.map((row) => row.identity.symbol));
        expect(page.metricCoverage[derived]).toEqual({ known: 4, unknown: 1 });
        expect(page.hasMore).toBe(offset < 4);
      }
      expect(symbols).toEqual(
        direction === "asc"
          ? ["BETA", "GAMMA", "ALPHA", "ALPHA.B", "UNKNOWN"]
          : ["ALPHA", "ALPHA.B", "GAMMA", "BETA", "UNKNOWN"],
      );
    }
    const purchaseFilter = run(
      identities,
      data,
      criteria([clause("ppePurchases", "lte", "0")]),
    );
    expect(purchaseFilter).toMatchObject({
      totalMatches: 1,
      totalNonMatches: 3,
      totalUnknown: 1,
    });
  });
});

describe("explicit financial-screen revenue basis", () => {
  it.each([false, true])(
    "preserves every legacy response property with explicit agreement (different bases: %s)",
    (different) => {
      const data = snapshot({
        [REVENUE]: [fact(1, "100")],
        Revenues: [fact(1, different ? "110" : "100")],
        NetIncomeLoss: [fact(1, "10")],
      });
      const legacy = run([identity("LEGACY", 1)], data);
      const explicit = run([identity("LEGACY", 1)], data, {
        ...criteria(),
        revenueBasis: "agreement",
      });
      expect(legacy).not.toHaveProperty("revenueBasis");
      const { revenueBasis, ...withoutEcho } = explicit;
      expect(revenueBasis).toBe("agreement");
      expect(JSON.stringify(withoutEcho)).toBe(JSON.stringify(legacy));
    },
  );

  it.each([
    { basis: "Revenues", revenue: "110", margins: ["10.00", "20.00", "30.00"] },
    { basis: REVENUE, revenue: "100", margins: ["11.00", "22.00", "33.00"] },
    {
      basis: "SalesRevenueNet",
      revenue: "90",
      margins: ["12.22", "24.44", "36.67"],
    },
  ] as const)(
    "uses $basis for revenue and every margin while preserving distinct reported bases",
    ({ basis, revenue, margins }) => {
      // Retail-like fixture: net sales and broader revenue legitimately differ.
      const data = snapshot({
        [REVENUE]: [fact(1, "100")],
        Revenues: [fact(1, "110")],
        SalesRevenueNet: [fact(1, "90")],
        NetIncomeLoss: [fact(1, "11")],
        OperatingIncomeLoss: [fact(1, "22")],
        NetCashProvidedByUsedInOperatingActivities: [fact(1, "33")],
      });
      const before = JSON.stringify(data);
      const selected = { ...criteria(), revenueBasis: basis };
      const result = run([identity("RETAIL", 1)], data, selected);
      const metrics = result.rows[0]!.metrics;
      expect(result).toMatchObject({
        revenueBasis: basis,
        formulaVersion: "1.1.0",
      });
      expect(metrics.revenue).toMatchObject({
        status: "available",
        value: revenue,
        sources: [{ concept: basis }],
      });
      expect(metrics.revenue.sources).toHaveLength(1);
      expect(
        [
          metrics.netMargin,
          metrics.operatingMargin,
          metrics.operatingCashFlowMargin,
        ].map((cell) => (cell.status === "available" ? cell.value : null)),
      ).toEqual(margins);
      for (const metric of [
        "netMargin",
        "operatingMargin",
        "operatingCashFlowMargin",
      ] as const) {
        expect(metrics[metric].sources).toHaveLength(2);
        expect(metrics[metric].sources[1]!.concept).toBe(basis);
      }
      expect(metrics.netIncome).toMatchObject({ value: "11" });
      expect(metrics.operatingIncome).toMatchObject({ value: "22" });
      expect(metrics.operatingCashFlow).toMatchObject({ value: "33" });
      expect(result.sources).toHaveLength(8);
      expect(JSON.stringify(data)).toBe(before);
      expect(selected.revenueBasis).toBe(basis);
    },
  );

  it("applies one basis across companies and recomputes filter/coverage counts without fallback", () => {
    const companies = [
      identity("BROAD", 1),
      identity("CONTRACTONLY", 2),
      identity("SMALL", 3),
    ];
    const data = snapshot({
      [REVENUE]: [fact(1, "100"), fact(2, "1000"), fact(3, "40")],
      Revenues: [fact(1, "110"), fact(3, "50")],
      NetIncomeLoss: [fact(1, "11"), fact(2, "100"), fact(3, "10")],
    });
    const broad = run(companies, data, {
      ...criteria([clause("revenue", "gte", "105")]),
      revenueBasis: "Revenues",
    });
    expect(broad).toMatchObject({
      totalMatches: 1,
      totalNonMatches: 1,
      totalUnknown: 1,
      rows: [{ identity: { symbol: "BROAD" } }],
    });
    expect(broad.metricCoverage.revenue).toEqual({ known: 2, unknown: 1 });
    const displayed = run(companies, data, {
      ...criteria(),
      revenueBasis: "Revenues",
    });
    expect(displayed.rows[1]!.metrics.revenue).toMatchObject({
      status: "unavailable",
      reason: "missing",
      sources: [],
    });
    expect(displayed.rows[1]!.metrics.netMargin).toMatchObject({
      status: "unavailable",
      reason: "missing",
    });
    const contract = run(companies, data, {
      ...criteria([clause("revenue", "gte", "105")]),
      revenueBasis: REVENUE,
    });
    expect(contract).toMatchObject({
      totalMatches: 1,
      totalNonMatches: 2,
      totalUnknown: 0,
      rows: [{ identity: { symbol: "CONTRACTONLY" } }],
    });
    const margin = run(companies, data, {
      ...criteria([clause("netMargin", "gte", "10.5")]),
      revenueBasis: "Revenues",
    });
    expect(margin).toMatchObject({
      totalMatches: 1,
      totalNonMatches: 1,
      totalUnknown: 1,
      rows: [{ identity: { symbol: "SMALL" } }],
    });
  });

  it.each([
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "does not let an unused %s source invalidate selected revenue",
    (status) => {
      const data = replaceFrame(
        snapshot({
          Revenues: [fact(1, "100")],
          NetIncomeLoss: [fact(1, "10")],
        }),
        REVENUE,
        { status },
      );
      const result = run([identity("SELECTED", 1)], data, {
        ...criteria(),
        revenueBasis: "Revenues",
      });
      expect(result.rows[0]!.metrics.revenue).toMatchObject({
        status: "available",
        value: "100",
      });
      expect(result.rows[0]!.metrics.netMargin).toMatchObject({
        status: "available",
        value: "10.00",
      });
      expect(result.sources).toContainEqual(
        expect.objectContaining({ concept: REVENUE, status }),
      );
      expect(
        run([identity("LEGACY", 1)], data).rows[0]!.metrics.revenue,
      ).toMatchObject({ status: "unavailable", reason: "source_unavailable" });
    },
  );

  it.each([
    { status: "rate_limited", reason: "source_unavailable" },
    { status: "upstream_unavailable", reason: "source_unavailable" },
    { status: "invalid_response", reason: "source_unavailable" },
    { status: "not_covered", reason: "missing" },
    { status: "available", reason: "missing" },
  ] as const)(
    "preserves selected $status without substituting another concept",
    ({ status, reason }) => {
      const data = replaceFrame(
        snapshot({
          [REVENUE]: [fact(1, "100")],
          NetIncomeLoss: [fact(1, "10")],
        }),
        "Revenues",
        { status },
      );
      const metrics = run([identity("UNAVAILABLE", 1)], data, {
        ...criteria(),
        revenueBasis: "Revenues",
      }).rows[0]!.metrics;
      expect(metrics.revenue).toMatchObject({
        status: "unavailable",
        reason,
        sources: [],
      });
      expect(metrics.netMargin).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(metrics.netIncome).toMatchObject({
        status: "available",
        value: "10",
      });
    },
  );

  it.each([
    { facts: [fact(1, "100"), fact(1, "101")] },
    { facts: [fact(1, "100"), fact(1, "100", { startDate: "2024-12-31" })] },
    { unknownCiks: [cik(1)] },
  ])("retains selected same-concept conflict %j", (conflict) => {
    const data = replaceFrame(
      snapshot({ [REVENUE]: [fact(1, "100")], Revenues: [fact(1, "100")] }),
      "Revenues",
      conflict,
    );
    expect(
      run([identity("CONFLICT", 1)], data, {
        ...criteria(),
        revenueBasis: "Revenues",
      }).rows[0]!.metrics.revenue,
    ).toMatchObject({ status: "unavailable", reason: "conflicting" });
  });

  it.each(["0", "-100"])(
    "keeps nonpositive selected revenue %s but blocks all margin denominators",
    (value) => {
      const data = snapshot({
        [REVENUE]: [fact(1, "100")],
        Revenues: [fact(1, value)],
        NetIncomeLoss: [fact(1, "10")],
        OperatingIncomeLoss: [fact(1, "20")],
        NetCashProvidedByUsedInOperatingActivities: [fact(1, "30")],
      });
      const metrics = run([identity("NONPOS", 1)], data, {
        ...criteria(),
        revenueBasis: "Revenues",
      }).rows[0]!.metrics;
      expect(metrics.revenue).toMatchObject({ status: "available", value });
      for (const metric of [
        "netMargin",
        "operatingMargin",
        "operatingCashFlowMargin",
      ] as const)
        expect(metrics[metric]).toMatchObject({
          status: "unavailable",
          reason: "nonpositive_revenue",
        });
    },
  );

  it("does not replace a selected period to make its margin compatible", () => {
    const data = snapshot({
      [REVENUE]: [fact(1, "100")],
      Revenues: [fact(1, "110", { startDate: "2024-12-31" })],
      NetIncomeLoss: [fact(1, "11")],
    });
    const metrics = run([identity("PERIOD", 1)], data, {
      ...criteria(),
      revenueBasis: "Revenues",
    }).rows[0]!.metrics;
    expect(metrics.revenue).toMatchObject({
      status: "available",
      value: "110",
    });
    expect(metrics.netMargin).toMatchObject({
      status: "unavailable",
      reason: "period_mismatch",
    });
  });
});

describe("financial-screen grammar and boundary validation", () => {
  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "accepts the explicit closed basis %s",
    (revenueBasis) => {
      expect(
        validatePersonalFinancialScreenCriteria({
          ...criteria(),
          revenueBasis,
        }),
      ).toBe(true);
      expect(
        run([], snapshot(), { ...criteria(), revenueBasis }).revenueBasis,
      ).toBe(revenueBasis);
    },
  );

  it.each([
    ...[
      undefined,
      null,
      "",
      "revenues",
      "Revenues ",
      "NetIncomeLoss",
      "auto",
      0,
      {},
      [],
    ].map((revenueBasis) => ({ ...criteria(), revenueBasis })),
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
    const unsafeBasis = {
      ...criteria(),
      get revenueBasis() {
        invoked = true;
        return "agreement";
      },
    };
    expect(validatePersonalFinancialScreenCriteria(unsafeBasis)).toBe(false);
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
