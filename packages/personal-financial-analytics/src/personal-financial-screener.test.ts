import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
  PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_REVENUE_CONCEPTS,
  PERSONAL_FINANCIAL_SCREEN_GROWTH_METRICS,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenClauseDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalSecAnnualConceptDto,
  type PersonalSecAnnualFactDto,
  type PersonalSecInstantFactDto,
  type PersonalSecInstantFrameDto,
  type PersonalSecFinancialSnapshotDto,
  type PersonalSecAnnualFrameDto,
  type PersonalSecRevenueConceptDto,
  type PersonalSecRevenueFrameDto,
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
      formulaVersion: "1.7.0",
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
      "grossMargin",
      "operatingCashFlowToNetIncome",
      "operatingCashFlowLessPpePurchasesMargin",
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
      "currentAssetsLessCurrentLiabilities",
      "totalAssets",
      "totalLiabilities",
      "revenueGrowth",
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
      schemaVersion: "10.0.0",
      formulaVersion: "1.7.0",
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
      expect(result.rows[0]!.metrics.grossMargin).toMatchObject({
        status: "unavailable",
        reason: "period_mismatch",
      });
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
      for (const metric of PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS)
        if (metric !== "grossProfit" && metric !== "grossMargin")
          expect(result.rows[0]!.metrics[metric].status).toBe("available");
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
          ([metric]) => metric !== "grossProfit" && metric !== "grossMargin",
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
        sort: { field: "unregisteredMargin", direction: "asc" },
      }),
    ).toBe(false);
  });
});

describe("PP&E purchases and operating cash flow less PP&E purchases", () => {
  const ocf = "NetCashProvidedByUsedInOperatingActivities";
  const ppe = "PaymentsToAcquirePropertyPlantAndEquipment";
  const derived = "operatingCashFlowLessPpePurchases";

  it("versions only the screen formula set and keeps existing ratio metadata", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.7.0");
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
    const cell = (data: PersonalSecFinancialSnapshotDto) =>
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
        formulaVersion: "1.7.0",
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
      expect(result.sources).toHaveLength(12);
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

describe("gross profit / selected revenue", () => {
  function cells(
    input: PersonalSecFinancialSnapshotDto,
    revenueBasis: PersonalFinancialRevenueBasisDto = REVENUE,
  ) {
    return run([identity("GROSS", 1)], input, {
      ...criteria(),
      revenueBasis,
    }).rows[0]!.metrics;
  }

  it("registers the existing gross-margin formula without reversioning earlier formulas", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.grossMargin).toEqual({
      formulaId: "gross_margin_percent",
      formulaVersion: "1.0.0",
      expression: "gross_profit / revenue * 100",
    });
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.grossMargin).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.grossMargin,
    );
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.7.0");
    for (const metric of [
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
    ] as const)
      expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[metric].formulaVersion).toBe(
        "1.0.0",
      );
    expect(
      PERSONAL_FINANCIAL_SCREEN_FORMULAS.operatingCashFlowLessPpePurchases
        .formulaVersion,
    ).toBe("1.1.0");
    expect(
      validatePersonalFinancialScreenCriteria({
        ...criteria([clause("grossMargin", "gte", "-1.01")]),
        sort: { field: "grossMargin", direction: "desc" },
      }),
    ).toBe(true);
  });

  it.each([
    ["1", "3", "33.33"],
    ["1.005", "100", "1.01"],
    ["-1.005", "100", "-1.01"],
    ["0", "100", "0.00"],
    ["-0", "100", "0.00"],
    ["-0.0049", "100", "0.00"],
    ["250", "100", "250.00"],
    ["-250", "100", "-250.00"],
    ["9007199254740993", "100", "9007199254740993.00"],
    ["1", "9007199254740993", "0.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
    ],
  ])("rounds %s / %s × 100 exactly to %s", (grossProfit, revenue, expected) => {
    const result = cells(
      snapshot({
        [REVENUE]: [fact(1, revenue)],
        GrossProfit: [fact(1, grossProfit)],
      }),
    );
    expect(result.grossMargin).toEqual({
      status: "available",
      value: expected,
      unit: "percent",
      sources: [...result.grossProfit.sources, ...result.revenue.sources],
    });
    if (grossProfit.length === 64) {
      expect(revenue).toHaveLength(64);
      expect(expected).toHaveLength(131);
    }
  });

  it.each(["0", "-100"])(
    "preserves nonpositive revenue %s as a reported operand",
    (revenue) => {
      const result = cells(
        snapshot({
          [REVENUE]: [fact(1, revenue)],
          GrossProfit: [fact(1, "-10")],
        }),
      );
      expect(result.revenue).toMatchObject({
        status: "available",
        value: revenue,
      });
      expect(result.grossProfit).toMatchObject({
        status: "available",
        value: "-10",
      });
      expect(result.grossMargin).toEqual({
        status: "unavailable",
        unit: "percent",
        reason: "nonpositive_revenue",
        sources: [...result.grossProfit.sources, ...result.revenue.sources],
      });
    },
  );

  it.each([
    [{ startDate: "2025-01-02" }, "period_mismatch"],
    [{ endDate: "2025-12-30" }, "period_mismatch"],
    [{ accessionNumber: "0000000001-26-000002" }, "filing_mismatch"],
  ] as const)(
    "rejects incompatible reported periods or filings %j",
    (difference, reason) => {
      const result = cells(
        snapshot({
          [REVENUE]: [fact(1, "100")],
          GrossProfit: [fact(1, "30", difference)],
        }),
      );
      expect(result.revenue.status).toBe("available");
      expect(result.grossProfit.status).toBe("available");
      expect(result.grossMargin).toEqual({
        status: "unavailable",
        unit: "percent",
        reason,
        sources: [...result.grossProfit.sources, ...result.revenue.sources],
      });
    },
  );

  it.each([
    ["2025-11-30", false],
    ["2025-12-01", true],
    ["2026-01-30", true],
    ["2026-01-31", false],
  ] as const)(
    "admits exactly 335–395 inclusive days, ending %s",
    (endDate, available) => {
      const result = cells(
        snapshot({
          [REVENUE]: [fact(1, "100", { endDate })],
          GrossProfit: [fact(1, "30", { endDate })],
          NetIncomeLoss: [fact(1, "10", { endDate })],
        }),
      );
      expect(result.grossMargin).toMatchObject(
        available
          ? { status: "available", value: "30.00" }
          : { status: "unavailable", reason: "period_mismatch" },
      );
      // The new annual guard does not change the existing net-margin eligibility.
      expect(result.netMargin).toMatchObject({
        status: "available",
        value: "10.00",
      });
    },
  );

  it.each([REVENUE, "GrossProfit"] as const)(
    "checks later retained filings in %s",
    (concept) => {
      const input = snapshot({
        [REVENUE]: [fact(1, "100")],
        GrossProfit: [fact(1, "30")],
      });
      const first = input.frames.find((frame) => frame.concept === concept)!
        .facts[0]!;
      const result = cells(
        replaceFrame(input, concept, {
          facts: [first, { ...first, accessionNumber: "0000000001-26-000002" }],
        }),
      );
      expect(result.revenue.status).toBe("available");
      expect(result.grossProfit.status).toBe("available");
      expect(result.grossMargin).toEqual({
        status: "unavailable",
        unit: "percent",
        reason: "filing_mismatch",
        sources: [...result.grossProfit.sources, ...result.revenue.sources],
      });
      expect(result.grossMargin.sources).toHaveLength(3);
    },
  );

  it("checks the last agreeing revenue concept and preserves the entire source multiset", () => {
    const input = snapshot({
      [REVENUE]: [fact(1, "100")],
      Revenues: [fact(1, "100.0")],
      SalesRevenueNet: [
        fact(1, "100.00", { accessionNumber: "0000000001-26-000002" }),
      ],
      GrossProfit: [fact(1, "30"), fact(1, "30.0")],
    });
    const before = JSON.stringify(input);
    const result = cells(input, "agreement");
    expect(result.revenue).toMatchObject({ status: "available", value: "100" });
    expect(result.grossMargin).toEqual({
      status: "unavailable",
      unit: "percent",
      reason: "filing_mismatch",
      sources: [...result.grossProfit.sources, ...result.revenue.sources],
    });
    expect(result.grossMargin.sources).toHaveLength(5);
    expect(JSON.stringify(input)).toBe(before);
  });

  const unknownOperands = [
    ["missing", { facts: [] }, "missing"],
    ["not covered", { status: "not_covered", facts: [] }, "missing"],
    [
      "rate limited",
      { status: "rate_limited", facts: [] },
      "source_unavailable",
    ],
    [
      "failed source",
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
      { facts: [fact(1, "30"), fact(1, "31")] },
      "conflicting",
    ],
    [
      "different later dates",
      { facts: [fact(1, "30"), fact(1, "30", { startDate: "2025-01-02" })] },
      "conflicting",
    ],
  ] satisfies readonly (readonly [
    string,
    Partial<PersonalSecAnnualFrameDto>,
    string,
  ])[];
  for (const concept of [REVENUE, "GrossProfit"] as const) {
    it.each(unknownOperands)(
      `propagates %s in ${concept}, retaining both operand reference lists`,
      (_label, changes, reason) => {
        const result = cells(
          replaceFrame(
            snapshot({
              [REVENUE]: [fact(1, "100")],
              GrossProfit: [fact(1, "30")],
            }),
            concept,
            changes,
          ),
        );
        const other = concept === REVENUE ? result.grossProfit : result.revenue;
        expect(other.status).toBe("available");
        expect(result.grossMargin).toEqual({
          status: "unavailable",
          unit: "percent",
          reason,
          sources: [...result.grossProfit.sources, ...result.revenue.sources],
        });
      },
    );
  }

  it("applies revenue, gross-profit, period, filing and sign precedence to simultaneous defects", () => {
    const base = snapshot({
      [REVENUE]: [fact(1, "0")],
      GrossProfit: [
        fact(1, "30", {
          startDate: "2025-01-02",
          accessionNumber: "0000000001-26-000002",
        }),
      ],
    });
    expect(cells(base).grossMargin).toMatchObject({
      reason: "period_mismatch",
    });
    const matchingPeriod = replaceFrame(base, "GrossProfit", {
      facts: [fact(1, "30", { accessionNumber: "0000000001-26-000002" })],
    });
    expect(cells(matchingPeriod).grossMargin).toMatchObject({
      reason: "filing_mismatch",
    });
    expect(
      cells(replaceFrame(base, "GrossProfit", { facts: [fact(1, "30")] }))
        .grossMargin,
    ).toMatchObject({ reason: "nonpositive_revenue" });
    expect(
      cells(replaceFrame(base, "GrossProfit", { unknownCiks: [cik(1)] }))
        .grossMargin,
    ).toMatchObject({ reason: "conflicting" });
    const invalidNumerator = replaceFrame(base, "GrossProfit", {
      facts: [fact(1, "NaN")],
    });
    expect(cells(invalidNumerator).grossMargin).toMatchObject({
      reason: "invalid_value",
    });
    expect(
      cells(replaceFrame(invalidNumerator, REVENUE, { facts: [] })).grossMargin,
    ).toMatchObject({ reason: "missing" });
    expect(
      cells(
        replaceFrame(invalidNumerator, REVENUE, {
          status: "upstream_unavailable",
          facts: [],
        }),
      ).grossMargin,
    ).toMatchObject({ reason: "source_unavailable" });
  });

  it("combines only observations indexed by the same CIK", () => {
    const input = snapshot({
      [REVENUE]: [fact(1, "100")],
      GrossProfit: [fact(2, "30")],
    });
    const result = run([identity("FIRST", 1), identity("SECOND", 2)], input);
    expect(result.metricCoverage.grossMargin).toEqual({ known: 0, unknown: 2 });
    for (const row of result.rows) {
      expect(row.metrics.grossMargin).toMatchObject({
        status: "unavailable",
        reason: "missing",
      });
      expect(row.metrics.grossMargin.sources).toHaveLength(1);
    }
  });

  it("uses each explicit denominator and retains omitted agreement without modifying the snapshot", () => {
    const input = snapshot({
      [REVENUE]: [fact(1, "100")],
      Revenues: [fact(1, "120")],
      SalesRevenueNet: [fact(1, "150")],
      GrossProfit: [fact(1, "30")],
    });
    const before = JSON.stringify(input);
    for (const [basis, expected] of [
      [REVENUE, "30.00"],
      ["Revenues", "25.00"],
      ["SalesRevenueNet", "20.00"],
    ] as const) {
      const result = cells(input, basis);
      expect(result.grossMargin).toMatchObject({
        status: "available",
        value: expected,
      });
      expect(
        result.grossMargin.sources.map((source) => source.concept),
      ).toEqual(["GrossProfit", basis]);
    }
    expect(cells(input, "agreement").grossMargin).toMatchObject({
      reason: "conflicting",
    });
    const agreeing = replaceFrame(
      replaceFrame(input, "Revenues", { facts: [fact(1, "100")] }),
      "SalesRevenueNet",
      { facts: [fact(1, "100")] },
    );
    const omitted = run([identity("GROSS", 1)], agreeing);
    expect(omitted.rows[0]!.metrics.grossMargin).toMatchObject({
      value: "30.00",
    });
    expect(omitted.rows[0]!.metrics.grossMargin).toEqual(
      cells(agreeing, "agreement").grossMargin,
    );
    expect(omitted).not.toHaveProperty("revenueBasis");
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "isolates an unselected %s source, while agreement and selected failure remain unknown",
    (status) => {
      const input = replaceFrame(
        snapshot({
          Revenues: [fact(1, "100")],
          GrossProfit: [fact(1, "30")],
        }),
        REVENUE,
        { status },
      );
      expect(cells(input, "Revenues").grossMargin).toMatchObject({
        status: "available",
        value: "30.00",
      });
      expect(cells(input, "agreement").grossMargin).toMatchObject({
        reason: "source_unavailable",
      });
      expect(cells(input, REVENUE).grossMargin).toMatchObject({
        reason: "source_unavailable",
      });
      expect(cells(input, "SalesRevenueNet").grossMargin).toMatchObject({
        reason: "missing",
      });
    },
  );

  it("keeps the ten prior metric values and coverage, and isolates operand failures", () => {
    const input = snapshot({
      [REVENUE]: [fact(1, "100")],
      GrossProfit: [fact(1, "40")],
      NetIncomeLoss: [fact(1, "10")],
      OperatingIncomeLoss: [fact(1, "20")],
      NetCashProvidedByUsedInOperatingActivities: [fact(1, "30")],
      PaymentsToAcquirePropertyPlantAndEquipment: [fact(1, "5")],
    });
    const baseline = run([identity("OLD", 1)], input);
    const oldValues = {
      revenue: "100",
      grossProfit: "40",
      netIncome: "10",
      operatingIncome: "20",
      operatingCashFlow: "30",
      netMargin: "10.00",
      operatingMargin: "20.00",
      operatingCashFlowMargin: "30.00",
      ppePurchases: "5",
      operatingCashFlowLessPpePurchases: "25",
    } as const;
    for (const metric of Object.keys(oldValues) as (keyof typeof oldValues)[]) {
      expect(baseline.rows[0]!.metrics[metric]).toMatchObject({
        status: "available",
        value: oldValues[metric],
      });
      expect(baseline.metricCoverage[metric]).toEqual({ known: 1, unknown: 0 });
    }
    const failedGross = run(
      [identity("OLD", 1)],
      replaceFrame(input, "GrossProfit", {
        status: "upstream_unavailable",
        facts: [],
      }),
    );
    for (const metric of Object.keys(oldValues) as (keyof typeof oldValues)[]) {
      if (metric === "grossProfit") continue;
      expect(failedGross.rows[0]!.metrics[metric]).toEqual(
        baseline.rows[0]!.metrics[metric],
      );
      expect(failedGross.metricCoverage[metric]).toEqual(
        baseline.metricCoverage[metric],
      );
    }
    expect(failedGross.metricCoverage.grossProfit).toEqual({
      known: 0,
      unknown: 1,
    });
    expect(failedGross.metricCoverage.grossMargin).toEqual({
      known: 0,
      unknown: 1,
    });
    const failedRevenue = cells(
      replaceFrame(input, REVENUE, { status: "rate_limited", facts: [] }),
    );
    for (const metric of [
      "grossProfit",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
    ] as const)
      expect(failedRevenue[metric]).toEqual(baseline.rows[0]!.metrics[metric]);
  });

  it("filters displayed half-up percentages inclusively and keeps stable security ordering across pages", () => {
    const companies = [
      identity("BETA", 2),
      identity("UNKNOWN", 4),
      identity("HIGH", 3),
      { ...identity("ALPHA.B", 1), listingId: "listing-0000000001-b" },
      identity("ALPHA", 1),
    ];
    const input = snapshot({
      [REVENUE]: [fact(1, "3"), fact(2, "100"), fact(3, "2"), fact(4, "100")],
      GrossProfit: [fact(1, "1"), fact(2, "33.334"), fact(3, "1")],
    });
    const inclusive = run(
      companies,
      input,
      criteria([
        clause("grossMargin", "gte", "33.33"),
        clause("grossMargin", "lte", "33.33"),
      ]),
    );
    expect(inclusive.rows.map((row) => row.identity.symbol)).toEqual([
      "ALPHA",
      "ALPHA.B",
      "BETA",
    ]);
    expect(inclusive).toMatchObject({
      totalMatches: 3,
      totalNonMatches: 1,
      totalUnknown: 1,
    });
    expect(inclusive.metricCoverage.grossMargin).toEqual({
      known: 4,
      unknown: 1,
    });
    expect(
      run(
        companies,
        input,
        criteria([clause("grossMargin", "gte", "33.33001")]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["HIGH"]);
    for (const direction of ["asc", "desc"] as const) {
      const filters = {
        ...criteria(),
        sort: { field: "grossMargin", direction } as const,
      };
      const full = run(companies, input, filters);
      const pages = [0, 2, 4].map((offset) =>
        run([...companies].reverse(), input, filters, { offset, limit: 2 }),
      );
      expect(pages.flatMap((page) => page.rows)).toEqual(full.rows);
      expect(full.rows.map((row) => row.identity.symbol)).toEqual(
        direction === "asc"
          ? ["ALPHA", "ALPHA.B", "BETA", "HIGH", "UNKNOWN"]
          : ["HIGH", "ALPHA", "ALPHA.B", "BETA", "UNKNOWN"],
      );
      for (const page of pages) {
        expect(page.metricCoverage.grossMargin).toEqual({
          known: 4,
          unknown: 1,
        });
        expect(page.financialSnapshotSha256).toBe(FINANCIAL_DIGEST);
      }
      expect(pages.map((page) => page.hasMore)).toEqual([true, true, false]);
    }
  });
});

describe("operating cash flow / net income", () => {
  const metric = "operatingCashFlowToNetIncome";
  const ocf = "NetCashProvidedByUsedInOperatingActivities";
  const income = "NetIncomeLoss";
  function cells(input: PersonalSecFinancialSnapshotDto) {
    return run([identity("CASH", 1)], input).rows[0]!.metrics;
  }

  it("registers a distinct formula while preserving the eleven metrics and every prior formula version", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS.at(11)).toBe(metric);
    expect(PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS).toHaveLength(13);
    expect(PERSONAL_SEC_ANNUAL_CONCEPTS).toHaveLength(8);
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[metric]).toEqual({
      formulaId: "operating_cash_flow_to_net_income_percent",
      formulaVersion: "1.0.0",
      expression: "operating_cash_flow / net_income * 100",
    });
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.7.0");
    for (const prior of [
      "grossMargin",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
    ] as const)
      expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[prior]).toEqual(
        PERSONAL_FINANCIAL_ANALYTICS_FORMULAS[prior],
      );
    expect(
      PERSONAL_FINANCIAL_SCREEN_FORMULAS.operatingCashFlowLessPpePurchases,
    ).toEqual({
      formulaId: "operating_cash_flow_less_ppe_purchases",
      formulaVersion: "1.1.0",
      expression: "operating_cash_flow - ppe_purchases",
    });
    expect(
      validatePersonalFinancialScreenCriteria({
        ...criteria([clause(metric, "gte", "150.00")]),
        sort: { field: metric, direction: "desc" },
      }),
    ).toBe(true);
  });

  it.each([
    ["150", "100", "150.00"],
    ["-50", "100", "-50.00"],
    ["0", "100", "0.00"],
    ["-0", "100", "0.00"],
    ["1", "3", "33.33"],
    ["1.005", "100", "1.01"],
    ["-1.005", "100", "-1.01"],
    ["-0.0049", "100", "0.00"],
    ["-0.005", "100", "-0.01"],
    ["9007199254740993", "100", "9007199254740993.00"],
    ["1", "9007199254740993", "0.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
    ],
  ])(
    "calculates %s / %s × 100 as %s without loss, clamping or negative zero",
    (cashFlow, netIncome, expected) => {
      const result = cells(
        snapshot({
          [ocf]: [fact(1, cashFlow)],
          [income]: [fact(1, netIncome)],
        }),
      );
      expect(result[metric]).toEqual({
        status: "available",
        unit: "percent",
        value: expected,
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
      if (cashFlow.length === 64) {
        expect(netIncome).toHaveLength(64);
        expect(expected).toHaveLength(131);
      }
    },
  );

  it.each(["0", "-0", "-100"])(
    "preserves reported nonpositive net income %s and returns its specific unknown reason",
    (value) => {
      const result = cells(
        snapshot({ [ocf]: [fact(1, "-50")], [income]: [fact(1, value)] }),
      );
      expect(result.netIncome).toMatchObject({
        status: "available",
        value: value === "-0" ? "0" : value,
      });
      expect(result.operatingCashFlow).toMatchObject({
        status: "available",
        value: "-50",
      });
      expect(result[metric]).toEqual({
        status: "unavailable",
        unit: "percent",
        reason: "nonpositive_net_income",
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
    },
  );

  it.each([
    [{ startDate: "2025-01-02" }, "period_mismatch"],
    [{ endDate: "2025-12-30" }, "period_mismatch"],
    [{ accessionNumber: "0000000001-26-000002" }, "filing_mismatch"],
  ] as const)(
    "rejects incompatible available operands %j",
    (difference, reason) => {
      const result = cells(
        snapshot({
          [ocf]: [fact(1, "150", difference)],
          [income]: [fact(1, "100")],
        }),
      );
      expect(result.netIncome.status).toBe("available");
      expect(result.operatingCashFlow.status).toBe("available");
      expect(result[metric]).toEqual({
        status: "unavailable",
        unit: "percent",
        reason,
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
    },
  );

  it.each([
    ["2025-11-30", false],
    ["2025-12-01", true],
    ["2025-12-30", true],
    ["2026-01-06", true],
    ["2026-01-30", true],
    ["2026-01-31", false],
  ] as const)(
    "uses the actual 335–395 inclusive-day window ending %s",
    (endDate, available) => {
      const result = cells(
        snapshot({
          [ocf]: [fact(1, "150", { endDate })],
          [income]: [fact(1, "100", { endDate })],
          [REVENUE]: [fact(1, "200", { endDate })],
        }),
      );
      expect(result[metric]).toEqual({
        ...(available
          ? { status: "available", value: "150.00" }
          : { status: "unavailable", reason: "period_mismatch" }),
        unit: "percent",
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
      expect(result.netMargin).toMatchObject({
        status: "available",
        value: "50.00",
      });
      expect(result.operatingCashFlowMargin).toMatchObject({
        status: "available",
        value: "75.00",
      });
    },
  );

  it.each([ocf, income] as const)(
    "checks later retained filings in %s, not just the first pair",
    (concept) => {
      const input = snapshot({
        [ocf]: [fact(1, "150")],
        [income]: [fact(1, "100")],
      });
      const first = input.frames.find((frame) => frame.concept === concept)!
        .facts[0]!;
      const result = cells(
        replaceFrame(input, concept, {
          facts: [first, { ...first, accessionNumber: "0000000001-26-000002" }],
        }),
      );
      expect(result.operatingCashFlow.status).toBe("available");
      expect(result.netIncome.status).toBe("available");
      expect(result[metric]).toEqual({
        status: "unavailable",
        unit: "percent",
        reason: "filing_mismatch",
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
      expect(result[metric].sources).toHaveLength(3);
    },
  );

  it("preserves duplicate agreeing references and input bytes for an available ratio", () => {
    const input = snapshot({
      [ocf]: [fact(1, "150"), fact(1, "150.00")],
      [income]: [fact(1, "100"), fact(1, "100.0")],
    });
    const before = JSON.stringify(input);
    const result = cells(input);
    expect(result[metric]).toEqual({
      status: "available",
      unit: "percent",
      value: "150.00",
      sources: [
        ...result.operatingCashFlow.sources,
        ...result.netIncome.sources,
      ],
    });
    expect(result[metric].sources.map((ref) => ref.value)).toEqual([
      "150",
      "150.00",
      "100",
      "100.0",
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });

  const unknownOperands = [
    ["missing", { facts: [] }, "missing"],
    ["not covered", { status: "not_covered", facts: [] }, "missing"],
    [
      "rate limited",
      { status: "rate_limited", facts: [] },
      "source_unavailable",
    ],
    [
      "failed source",
      { status: "upstream_unavailable", facts: [] },
      "source_unavailable",
    ],
    [
      "invalid source",
      { status: "invalid_response", facts: [] },
      "source_unavailable",
    ],
    ["ambiguous issuer", { unknownCiks: [cik(1)] }, "conflicting"],
    ["invalid number", { facts: [fact(1, "NaN")] }, "invalid_value"],
    [
      "conflicting values",
      { facts: [fact(1, "30"), fact(1, "31")] },
      "conflicting",
    ],
    [
      "later period difference",
      { facts: [fact(1, "30"), fact(1, "30", { startDate: "2025-01-02" })] },
      "conflicting",
    ],
  ] satisfies readonly (readonly [
    string,
    Partial<PersonalSecAnnualFrameDto>,
    string,
  ])[];
  for (const concept of [ocf, income] as const) {
    it.each(unknownOperands)(
      `propagates %s in ${concept} and retains both source lists`,
      (_label, changes, reason) => {
        const result = cells(
          replaceFrame(
            snapshot({ [ocf]: [fact(1, "150")], [income]: [fact(1, "100")] }),
            concept,
            changes,
          ),
        );
        expect(
          (concept === income ? result.operatingCashFlow : result.netIncome)
            .status,
        ).toBe("available");
        expect(result[metric]).toEqual({
          status: "unavailable",
          unit: "percent",
          reason,
          sources: [
            ...result.operatingCashFlow.sources,
            ...result.netIncome.sources,
          ],
        });
      },
    );
  }

  it("applies net-income, cash-flow, period, filing and denominator precedence to combined defects", () => {
    const base = snapshot({
      [income]: [fact(1, "0")],
      [ocf]: [
        fact(1, "150", {
          startDate: "2025-01-02",
          accessionNumber: "0000000001-26-000002",
        }),
      ],
    });
    const variants = [
      [base, "period_mismatch"],
      [
        replaceFrame(base, ocf, {
          facts: [fact(1, "150", { accessionNumber: "0000000001-26-000002" })],
        }),
        "filing_mismatch",
      ],
      [
        replaceFrame(base, ocf, { facts: [fact(1, "150")] }),
        "nonpositive_net_income",
      ],
      [replaceFrame(base, ocf, { unknownCiks: [cik(1)] }), "conflicting"],
      [replaceFrame(base, ocf, { facts: [fact(1, "NaN")] }), "invalid_value"],
      [
        replaceFrame(
          replaceFrame(base, ocf, { facts: [fact(1, "NaN")] }),
          income,
          { facts: [] },
        ),
        "missing",
      ],
      [
        replaceFrame(
          replaceFrame(base, ocf, { unknownCiks: [cik(1)] }),
          income,
          { status: "rate_limited", facts: [] },
        ),
        "source_unavailable",
      ],
      [
        replaceFrame(
          replaceFrame(base, ocf, { status: "invalid_response", facts: [] }),
          income,
          { unknownCiks: [cik(1)] },
        ),
        "conflicting",
      ],
      [
        replaceFrame(
          replaceFrame(base, ocf, { status: "invalid_response", facts: [] }),
          income,
          { facts: [fact(1, "NaN")] },
        ),
        "invalid_value",
      ],
    ] as const;
    for (const [input, reason] of variants) {
      const result = cells(input);
      expect(result[metric]).toEqual({
        status: "unavailable",
        unit: "percent",
        reason,
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.netIncome.sources,
        ],
      });
    }
  });

  it("never combines different issuers even when dates, accession and amounts appear compatible", () => {
    const input = snapshot({
      [ocf]: [fact(1, "150")],
      [income]: [fact(2, "100", { accessionNumber: "0000000001-26-000001" })],
    });
    const result = run([identity("FIRST", 1), identity("SECOND", 2)], input);
    expect(result.metricCoverage[metric]).toEqual({ known: 0, unknown: 2 });
    for (const row of result.rows) {
      expect(row.metrics[metric]).toMatchObject({
        status: "unavailable",
        reason: "missing",
      });
      expect(row.metrics[metric].sources).toHaveLength(1);
    }
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "keeps available and unknown ratios independent of %s, revenue failures and PP&E",
    (revenueBasis) => {
      const independent = snapshot({
        [ocf]: [fact(1, "150")],
        [income]: [fact(1, "100")],
      });
      const unrelated = replaceFrame(
        snapshot({
          [ocf]: [fact(1, "150")],
          [income]: [fact(1, "100")],
          Revenues: [fact(1, "0")],
          SalesRevenueNet: [fact(1, "-10")],
          GrossProfit: [fact(1, "NaN")],
          PaymentsToAcquirePropertyPlantAndEquipment: [fact(1, "-500")],
        }),
        REVENUE,
        { status: "upstream_unavailable" },
      );
      const before = JSON.stringify(unrelated);
      for (const incomeFacts of [[fact(1, "100")], [fact(1, "0")], []]) {
        const baseline = run(
          [identity("CASH", 1)],
          replaceFrame(independent, income, { facts: incomeFacts }),
        );
        const actual = run(
          [identity("CASH", 1)],
          replaceFrame(unrelated, income, { facts: incomeFacts }),
          { ...criteria(), revenueBasis },
        );
        expect(actual.rows[0]!.metrics[metric]).toEqual(
          baseline.rows[0]!.metrics[metric],
        );
        expect(actual.metricCoverage[metric]).toEqual(
          baseline.metricCoverage[metric],
        );
        expect(
          actual.rows[0]!.metrics[metric].sources.every((ref) =>
            [ocf, income].includes(ref.concept as typeof ocf | typeof income),
          ),
        ).toBe(true);
      }
      expect(JSON.stringify(unrelated)).toBe(before);
    },
  );

  it("preserves all eleven prior cells and their coverage when the new filing guard is inapplicable", () => {
    const input = snapshot({
      [REVENUE]: [fact(1, "100")],
      GrossProfit: [fact(1, "40")],
      [income]: [fact(1, "10", { accessionNumber: "0000000001-26-000002" })],
      OperatingIncomeLoss: [fact(1, "20")],
      [ocf]: [fact(1, "30")],
      PaymentsToAcquirePropertyPlantAndEquipment: [fact(1, "5")],
    });
    const result = run([identity("OLD", 1)], input);
    const source = (concept: PersonalSecAnnualConceptDto) =>
      input.frames
        .find((frame) => frame.concept === concept)!
        .facts.map(({ accessionNumber, startDate, endDate, value }) => ({
          concept,
          accessionNumber,
          startDate,
          endDate,
          value,
        }));
    const expected = {
      revenue: ["100", "USD", source(REVENUE)],
      grossProfit: ["40", "USD", source("GrossProfit")],
      netIncome: ["10", "USD", source(income)],
      operatingIncome: ["20", "USD", source("OperatingIncomeLoss")],
      operatingCashFlow: ["30", "USD", source(ocf)],
      netMargin: ["10.00", "percent", [...source(income), ...source(REVENUE)]],
      operatingMargin: [
        "20.00",
        "percent",
        [...source("OperatingIncomeLoss"), ...source(REVENUE)],
      ],
      operatingCashFlowMargin: [
        "30.00",
        "percent",
        [...source(ocf), ...source(REVENUE)],
      ],
      ppePurchases: [
        "5",
        "USD",
        source("PaymentsToAcquirePropertyPlantAndEquipment"),
      ],
      operatingCashFlowLessPpePurchases: [
        "25",
        "USD",
        [
          ...source(ocf),
          ...source("PaymentsToAcquirePropertyPlantAndEquipment"),
        ],
      ],
      grossMargin: [
        "40.00",
        "percent",
        [...source("GrossProfit"), ...source(REVENUE)],
      ],
    } as const;
    expect(Object.keys(expected)).toEqual(
      PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS.slice(0, 11),
    );
    for (const oldMetric of Object.keys(
      expected,
    ) as (keyof typeof expected)[]) {
      const [value, unit, sources] = expected[oldMetric];
      expect(result.rows[0]!.metrics[oldMetric]).toEqual({
        status: "available",
        value,
        unit,
        sources,
      });
      expect(result.metricCoverage[oldMetric]).toEqual({
        known: 1,
        unknown: 0,
      });
    }
    expect(result.rows[0]!.metrics[metric]).toMatchObject({
      status: "unavailable",
      reason: "filing_mismatch",
    });
    expect(result.metricCoverage[metric]).toEqual({ known: 0, unknown: 1 });
    expect(result.schemaVersion).toBe("10.0.0");
  });

  it("uses inclusive rounded thresholds, separates unknowns and orders duplicate listings stably across pages", () => {
    const companies = [
      identity("BETA", 2),
      identity("MISSING", 4),
      identity("HIGH", 3),
      { ...identity("ALPHA.B", 1), listingId: "listing-0000000001-b" },
      identity("ALPHA", 1),
      identity("ZERO", 5),
      identity("NEGATIVE", 6),
      identity("LOSS", 7),
    ];
    const input = snapshot({
      [income]: [
        fact(1, "3"),
        fact(2, "100"),
        fact(3, "100"),
        fact(4, "100"),
        fact(5, "100"),
        fact(6, "100"),
        fact(7, "-10"),
      ],
      [ocf]: [
        fact(1, "1"),
        fact(2, "33.334"),
        fact(3, "150"),
        fact(5, "-0.0049"),
        fact(6, "-1.005"),
        fact(7, "150"),
      ],
    });
    const inclusive = run(
      companies,
      input,
      criteria([
        clause(metric, "gte", "33.33"),
        clause(metric, "lte", "33.33"),
      ]),
    );
    expect(inclusive.rows.map((row) => row.identity.symbol)).toEqual([
      "ALPHA",
      "ALPHA.B",
      "BETA",
    ]);
    expect(inclusive).toMatchObject({
      totalMatches: 3,
      totalNonMatches: 3,
      totalUnknown: 2,
    });
    expect(inclusive.metricCoverage[metric]).toEqual({ known: 6, unknown: 2 });
    for (const [operator, threshold, symbols] of [
      ["gte", "33.33001", ["HIGH"]],
      ["lte", "-1.01", ["NEGATIVE"]],
      ["gte", "0", ["ALPHA", "ALPHA.B", "BETA", "HIGH", "ZERO"]],
      ["gte", "150", ["HIGH"]],
    ] as const) {
      expect(
        run(
          companies,
          input,
          criteria([clause(metric, operator, threshold)]),
        ).rows.map((row) => row.identity.symbol),
      ).toEqual(symbols);
    }
    for (const direction of ["asc", "desc"] as const) {
      const filters: PersonalFinancialScreenCriteriaDto = {
        ...criteria(),
        sort: { field: metric, direction },
      };
      const full = run(companies, input, filters);
      const pages = [0, 3, 6].map((offset) =>
        run([...companies].reverse(), input, filters, { offset, limit: 3 }),
      );
      expect(pages.flatMap((page) => page.rows)).toEqual(full.rows);
      expect(full.rows.map((row) => row.identity.symbol)).toEqual(
        direction === "asc"
          ? [
              "NEGATIVE",
              "ZERO",
              "ALPHA",
              "ALPHA.B",
              "BETA",
              "HIGH",
              "LOSS",
              "MISSING",
            ]
          : [
              "HIGH",
              "ALPHA",
              "ALPHA.B",
              "BETA",
              "ZERO",
              "NEGATIVE",
              "LOSS",
              "MISSING",
            ],
      );
      for (const page of pages) {
        expect(page.metricCoverage[metric]).toEqual({ known: 6, unknown: 2 });
        expect(page.financialSnapshotSha256).toBe(FINANCIAL_DIGEST);
        expect(page.totalUnknown).toBe(0);
      }
      expect(pages.map((page) => page.hasMore)).toEqual([true, true, false]);
      const bySymbol = new Map(
        full.rows.map((row) => [row.identity.symbol, row]),
      );
      expect(bySymbol.get("ALPHA")!.metrics).toEqual(
        bySymbol.get("ALPHA.B")!.metrics,
      );
      expect(bySymbol.get("LOSS")!.metrics[metric]).toMatchObject({
        reason: "nonpositive_net_income",
      });
    }
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

describe("operating cash flow less PP&E purchases / selected revenue", () => {
  const metric = "operatingCashFlowLessPpePurchasesMargin";
  const ocf = "NetCashProvidedByUsedInOperatingActivities";
  const ppe = "PaymentsToAcquirePropertyPlantAndEquipment";
  const operands = [REVENUE, ocf, ppe] as const;
  function input(cash = "30", purchases = "5", revenue = "100") {
    return snapshot({
      [REVENUE]: [fact(1, revenue)],
      [ocf]: [fact(1, cash)],
      [ppe]: [fact(1, purchases)],
    });
  }
  function cells(source: PersonalSecFinancialSnapshotDto) {
    return run([identity("CASH", 1)], source).rows[0]!.metrics;
  }

  it("retains the annual formula in the expanded fifteen-Frame transport and saved criteria grammar", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS.at(-1)).toBe(metric);
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toHaveLength(20);
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[metric]).toEqual({
      formulaId: "operating_cash_flow_less_ppe_purchases_to_revenue_percent",
      formulaVersion: "1.0.0",
      expression:
        "(operating_cash_flow - ppe_purchases) / selected_revenue * 100",
    });
    const source = input();
    expect(
      source.frames.length +
        source.instantFrames.length +
        source.priorRevenueFrames.length,
    ).toBe(15);
    const filters = {
      ...criteria([clause(metric, "gte", "-1.25")]),
      sort: { field: metric, direction: "desc" },
    };
    expect(validatePersonalFinancialScreenCriteria(filters)).toBe(true);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...filters,
        formulaVersion: "1.7.0",
      }),
    ).toBe(false);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...filters,
        sort: { field: "freeCashFlowMargin", direction: "desc" },
      }),
    ).toBe(false);
  });

  it.each([
    ["30", "5", "100", "25.00"],
    ["-30", "5", "100", "-35.00"],
    ["5", "30", "100", "-25.00"],
    ["5", "5", "100", "0.00"],
    ["-0", "-0", "100", "0.00"],
    ["1.015", "0.01", "100", "1.01"],
    ["0.01", "1.015", "100", "-1.01"],
    ["0", "0.0049", "100", "0.00"],
    ["0", "0.005", "100", "-0.01"],
    ["1.0049", "0", "100", "1.00"],
    ["1.0049", "0.0001", "0.1", "1004.80"],
    ["1", "0", "3", "33.33"],
    ["9007199254740993.0001", "9007199254740993", "0.001", "10.00"],
    [
      "9".repeat(64),
      "0",
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
    ],
    [
      `-${"9".repeat(63)}`,
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `-${(BigInt("9".repeat(63)) + BigInt("9".repeat(64))).toString()}${"0".repeat(64)}.00`,
    ],
  ])(
    "subtracts %s less %s then divides by %s and rounds once to %s",
    (cash, purchases, revenue, expected) => {
      const result = cells(input(cash, purchases, revenue));
      expect(result[metric]).toEqual({
        status: "available",
        unit: "percent",
        value: expected,
        sources: [
          ...result.operatingCashFlow.sources,
          ...result.ppePurchases.sources,
          ...result.revenue.sources,
        ],
      });
      if (cash.length === 64 && cash.startsWith("-"))
        expect(expected).toHaveLength(133);
    },
  );

  it.each(["0", "-0", "-100"])(
    "requires strictly positive selected revenue %s",
    (revenue) => {
      expect(cells(input("30", "5", revenue))[metric]).toMatchObject({
        status: "unavailable",
        reason: "nonpositive_revenue",
      });
    },
  );

  it("rejects negative PP&E purchases before a nonpositive denominator", () => {
    const result = cells(input("-30", "-5", "0"));
    expect(result[metric]).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
    expect(result.ppePurchases).toMatchObject({
      status: "available",
      value: "-5",
    });
  });

  it.each([334, 335, 365, 395, 396])(
    "requires every annual operand to share a supported %s-day actual period",
    (days) => {
      const endDate = new Date(
        Date.parse("2025-01-01") + (days - 1) * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      const source = snapshot(
        Object.fromEntries(
          operands.map((concept) => [
            concept,
            [fact(1, concept === REVENUE ? "100" : "10", { endDate })],
          ]),
        ),
      );
      expect(cells(source)[metric]).toMatchObject(
        days >= 335 && days <= 395
          ? { status: "available", value: "0.00" }
          : { status: "unavailable", reason: "period_mismatch" },
      );
    },
  );

  it.each(operands)(
    "checks the actual dates and filing of the %s operand",
    (concept) => {
      for (const difference of [
        { startDate: "2025-01-02" },
        { endDate: "2025-12-30" },
        { accessionNumber: "0000000001-26-000002" },
        { startDate: "2025-01-02", accessionNumber: "0000000001-26-000002" },
      ]) {
        const source = input("30", "-5", "0");
        const frame = source.frames.find((item) => item.concept === concept)!;
        const changed = replaceFrame(source, concept, {
          facts: frame.facts.map((value) => ({ ...value, ...difference })),
        });
        const result = cells(changed);
        expect(result[metric]).toEqual({
          status: "unavailable",
          unit: "percent",
          reason:
            "startDate" in difference || "endDate" in difference
              ? "period_mismatch"
              : "filing_mismatch",
          sources: [
            ...result.operatingCashFlow.sources,
            ...result.ppePurchases.sources,
            ...result.revenue.sources,
          ],
        });
      }
    },
  );

  it.each(operands)(
    "retains every duplicate %s source and checks its filing",
    (concept) => {
      const source = input();
      const original = source.frames.find((frame) => frame.concept === concept)!
        .facts[0]!;
      const agreeing = replaceFrame(source, concept, {
        facts: [original, { ...original }],
      });
      const good = cells(agreeing);
      expect(good[metric].sources).toHaveLength(4);
      expect(good[metric]).toMatchObject({
        status: "available",
        value: "25.00",
      });
      const changed = cells(
        replaceFrame(agreeing, concept, {
          facts: [
            original,
            { ...original, accessionNumber: "0000000001-26-000002" },
          ],
        }),
      );
      expect(changed[metric]).toMatchObject({
        status: "unavailable",
        reason: "filing_mismatch",
      });
      expect(changed[metric].sources).toHaveLength(4);
    },
  );

  it("retains all agreeing revenue concepts and uses only the explicitly selected basis", () => {
    const source = replaceFrame(
      replaceFrame(input(), "Revenues", {
        facts: [fact(1, "100"), fact(1, "100.0")],
      }),
      "SalesRevenueNet",
      { facts: [fact(1, "100")] },
    );
    const good = cells(source);
    expect(good[metric].sources).toHaveLength(6);
    expect(good[metric]).toMatchObject({ value: "25.00" });
    const mismatched = replaceFrame(source, "SalesRevenueNet", {
      facts: [fact(1, "100", { accessionNumber: "0000000001-26-000002" })],
    });
    expect(cells(mismatched)[metric]).toMatchObject({
      reason: "filing_mismatch",
    });
    for (const basis of PERSONAL_SEC_REVENUE_CONCEPTS) {
      const result = run([identity("CASH", 1)], source, {
        ...criteria(),
        revenueBasis: basis,
      }).rows[0]!.metrics;
      expect(result[metric]).toMatchObject({
        status: "available",
        value: "25.00",
      });
      expect(
        result[metric].sources.filter((ref) =>
          PERSONAL_SEC_REVENUE_CONCEPTS.some(
            (revenue) => ref.concept === revenue,
          ),
        ),
      ).toEqual(result.revenue.sources);
    }
  });

  it.each(operands)(
    "preserves every unresolved %s reason and its retained evidence",
    (concept) => {
      for (const [overrides, reason] of [
        [{ status: "upstream_unavailable", facts: [] }, "source_unavailable"],
        [{ status: "not_covered", facts: [] }, "missing"],
        [{ facts: [] }, "missing"],
        [{ unknownCiks: [cik(1)] }, "conflicting"],
        [{ facts: [fact(1, "bad")] }, "invalid_value"],
        [{ facts: [fact(1, "100"), fact(1, "101")] }, "conflicting"],
      ] as const) {
        const result = cells(replaceFrame(input(), concept, overrides));
        expect(result[metric]).toEqual({
          status: "unavailable",
          unit: "percent",
          reason,
          sources: [
            ...result.operatingCashFlow.sources,
            ...result.ppePurchases.sources,
            ...result.revenue.sources,
          ],
        });
      }
    },
  );

  it("prioritizes unresolved revenue, cash flow, then PP&E before compatibility and signs", () => {
    let source = replaceFrame(
      replaceFrame(
        replaceFrame(input("-30", "-5", "0"), REVENUE, {
          facts: [fact(1, "bad")],
        }),
        ocf,
        { unknownCiks: [cik(1)] },
      ),
      ppe,
      { facts: [] },
    );
    expect(cells(source)[metric]).toMatchObject({ reason: "invalid_value" });
    source = replaceFrame(source, REVENUE, {
      facts: [fact(1, "0", { startDate: "2025-01-02" })],
    });
    expect(cells(source)[metric]).toMatchObject({ reason: "conflicting" });
    source = replaceFrame(source, ocf, { unknownCiks: [] });
    expect(cells(source)[metric]).toMatchObject({ reason: "missing" });
    source = replaceFrame(source, ppe, { facts: [fact(1, "-5")] });
    expect(cells(source)[metric]).toMatchObject({ reason: "period_mismatch" });
  });

  it("filters the rounded signed percentage inclusively, separates failures from unknowns, and pages stable ties", () => {
    const companies = [
      identity("BETA", 2),
      identity("UNKNOWN", 4),
      identity("HIGH", 3),
      { ...identity("ALPHA.B", 1), listingId: "listing-0000000001-b" },
      identity("ALPHA", 1),
    ];
    const source = snapshot({
      [REVENUE]: [fact(1, "3"), fact(2, "100"), fact(3, "100"), fact(4, "100")],
      [ocf]: [fact(1, "0"), fact(2, "0"), fact(3, "50")],
      [ppe]: [fact(1, "1"), fact(2, "33.334"), fact(3, "0"), fact(4, "0")],
    });
    const matches = run(
      companies,
      source,
      criteria([
        clause(metric, "gte", "-33.33"),
        clause(metric, "lte", "-33.33"),
      ]),
    );
    expect(matches.rows.map((row) => row.identity.symbol)).toEqual([
      "ALPHA",
      "ALPHA.B",
      "BETA",
    ]);
    expect(matches).toMatchObject({
      totalMatches: 3,
      totalNonMatches: 1,
      totalUnknown: 1,
    });
    expect(
      run(
        companies,
        source,
        criteria([clause(metric, "gte", "-33.329")]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["HIGH"]);
    expect(
      run(
        companies,
        source,
        criteria([clause(metric, "gte", "0"), clause("revenue", "lte", "0")]),
      ),
    ).toMatchObject({ totalNonMatches: 5, totalUnknown: 0 });
    for (const direction of ["asc", "desc"] as const) {
      const filters = {
        ...criteria(),
        sort: { field: metric, direction } as const,
      };
      const full = run(companies, source, filters);
      const pages = [0, 2, 4].map((offset) =>
        run([...companies].reverse(), source, filters, { offset, limit: 2 }),
      );
      expect(pages.flatMap((page) => page.rows)).toEqual(full.rows);
      expect(full.rows.map((row) => row.identity.symbol)).toEqual(
        direction === "asc"
          ? ["ALPHA", "ALPHA.B", "BETA", "HIGH", "UNKNOWN"]
          : ["HIGH", "ALPHA", "ALPHA.B", "BETA", "UNKNOWN"],
      );
      for (const page of pages)
        expect(page.metricCoverage[metric]).toEqual({ known: 4, unknown: 1 });
    }
  });
});

function run(
  identities: readonly PersonalSecurityMasterScreenRowDto[],
  input: PersonalSecFinancialSnapshotDto,
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
): PersonalSecFinancialSnapshotDto {
  return {
    calendarYear: 2025,
    fetchedAt: "2026-09-09T12:00:00Z",
    expiresAt: "2026-09-09T12:30:00Z",
    snapshotSha256: FINANCIAL_DIGEST,
    priorCalendarYear: 2024,
    priorRevenueFrames: PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
      facts: [],
      unknownCiks: [],
    })),
    instantQuarter: 4,
    instantFrames: PERSONAL_SEC_INSTANT_CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025Q4I.json`,
      facts: [],
      unknownCiks: [],
    })),
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
  input: PersonalSecFinancialSnapshotDto,
  concept: PersonalSecAnnualConceptDto,
  overrides: Partial<PersonalSecAnnualFrameDto>,
): PersonalSecFinancialSnapshotDto {
  return {
    ...input,
    frames: input.frames.map((frame) =>
      frame.concept === concept ? { ...frame, ...overrides } : frame,
    ),
  };
}

describe("reported total assets and total liabilities", () => {
  const totals = [
    ["totalAssets", "Assets"],
    ["totalLiabilities", "Liabilities"],
  ] as const;
  const oldMetrics = [
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
    "grossMargin",
    "operatingCashFlowToNetIncome",
    "operatingCashFlowLessPpePurchasesMargin",
    "currentAssets",
    "currentLiabilities",
    "currentRatio",
    "currentAssetsLessCurrentLiabilities",
    "revenueGrowth",
  ] as const;
  function replaceTotal(
    input: PersonalSecFinancialSnapshotDto,
    concept: "Assets" | "Liabilities",
    patch: Partial<PersonalSecInstantFrameDto>,
  ): PersonalSecFinancialSnapshotDto {
    return {
      ...input,
      instantFrames: input.instantFrames.map((frame) =>
        frame.concept === concept ? { ...frame, ...patch } : frame,
      ),
    };
  }

  it("adds only two direct instant amounts, retaining the old relative order and formula set", () => {
    const result = run([identity("TOTALS", 1)], snapshot());
    expect(
      PERSONAL_FINANCIAL_SCREEN_METRICS.filter(
        (metric) => metric !== "totalAssets" && metric !== "totalLiabilities",
      ),
    ).toEqual(oldMetrics);
    expect(PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS.slice(-2)).toEqual([
      "totalAssets",
      "totalLiabilities",
    ]);
    expect(result).toMatchObject({
      schemaVersion: "10.0.0",
      formulaVersion: "1.7.0",
    });
    expect(result.sources.length + result.priorRevenueSources.length).toBe(15);
    for (const [metric, concept] of totals) {
      expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS).not.toHaveProperty(metric);
      expect(result.sources).toContainEqual({
        concept,
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025Q4I.json`,
      });
    }
  });

  describe.each(totals)("%s from %s only", (metric, concept) => {
    const otherMetric =
      metric === "totalAssets" ? "totalLiabilities" : "totalAssets";
    const otherConcept = concept === "Assets" ? "Liabilities" : "Assets";
    function input(patch: Partial<PersonalSecInstantFrameDto>) {
      return replaceTotal(
        replaceTotal(
          balances([instantFact(1, "25")], [instantFact(1, "10")]),
          otherConcept,
          { facts: [instantFact(1, "800")] },
        ),
        concept,
        patch,
      );
    }
    const cells = (source: PersonalSecFinancialSnapshotDto) =>
      run([identity("TOTAL", 1)], source).rows[0]!.metrics;

    it.each([
      ["0", "0"],
      ["-0.000", "0"],
      ["-25.125", "-25.125"],
      [
        "9007199254740993.00000000000000001",
        "9007199254740993.00000000000000001",
      ],
      ["9".repeat(64), "9".repeat(64)],
      [`0.${"0".repeat(61)}1`, `0.${"0".repeat(61)}1`],
      ["123.4500", "123.45"],
    ])(
      "preserves reported %s as %s without reversing credit signs",
      (value, expected) => {
        const result = cells(input({ facts: [instantFact(1, value)] }));
        expect(result[metric]).toEqual({
          status: "available",
          unit: "USD",
          value: expected,
          sources: [
            {
              concept,
              accessionNumber: "0000000001-26-000001",
              asOfDate: "2025-12-31",
              value,
            },
          ],
        });
        expect(result[otherMetric]).toMatchObject({
          status: "available",
          value: "800",
        });
      },
    );

    it.each(["2025-10-01", "2025-11-29", "2025-12-31"])(
      "retains its own valid date %s without requiring the other total's date or accession",
      (asOfDate) => {
        const result = cells(
          input({
            facts: [
              instantFact(1, "100", {
                asOfDate,
                accessionNumber: "0000000001-26-000009",
              }),
            ],
          }),
        );
        expect(result[metric]).toMatchObject({
          status: "available",
          value: "100",
          sources: [
            { concept, asOfDate, accessionNumber: "0000000001-26-000009" },
          ],
        });
        expect(result[otherMetric]).toMatchObject({
          status: "available",
          value: "800",
        });
      },
    );

    it.each(["2024-12-31", "2025-09-30", "2026-01-01"])(
      "retains unsupported date %s as evidence without changing the valid other total",
      (asOfDate) => {
        const result = cells(
          input({ facts: [instantFact(1, "100", { asOfDate })] }),
        );
        expect(result[metric]).toMatchObject({
          status: "unavailable",
          reason: "unsupported_balance_date",
          sources: [{ concept, asOfDate }],
        });
        expect(result[otherMetric]).toMatchObject({
          status: "available",
          value: "800",
        });
      },
    );

    it.each([
      [{ facts: [] }, "missing"],
      [{ status: "not_covered", facts: [] }, "missing"],
      [{ status: "rate_limited", facts: [] }, "source_unavailable"],
      [{ status: "upstream_unavailable", facts: [] }, "source_unavailable"],
      [{ status: "invalid_response", facts: [] }, "source_unavailable"],
      [
        { facts: [instantFact(1, "100")], unknownCiks: [cik(1)] },
        "conflicting",
      ],
      [
        { facts: [instantFact(1, "100"), instantFact(1, "101")] },
        "conflicting",
      ],
      [
        {
          facts: [
            instantFact(1, "100"),
            instantFact(1, "100", { asOfDate: "2025-12-30" }),
          ],
        },
        "conflicting",
      ],
      [{ facts: [instantFact(1, "NaN")] }, "invalid_value"],
    ] satisfies readonly (readonly [
      Partial<PersonalSecInstantFrameDto>,
      string,
    ])[])(
      "keeps direct concept state %j unavailable as %s without substituting current balances",
      (patch, reason) => {
        const source = input(patch);
        const result = cells(source);
        expect(result[metric]).toMatchObject({
          status: "unavailable",
          unit: "USD",
          reason,
        });
        expect(result[otherMetric]).toMatchObject({
          status: "available",
          value: "800",
        });
        expect(result.currentAssets).toMatchObject({
          status: "available",
          value: "25",
        });
        expect(result.currentLiabilities).toMatchObject({
          status: "available",
          value: "10",
        });
        const filtered = run(
          [identity("TOTAL", 1)],
          source,
          criteria([clause(metric, "gte", "0")]),
        );
        expect(filtered).toMatchObject({ totalMatches: 0, totalUnknown: 1 });
      },
    );

    it("retains agreeing duplicate facts and every accession for a direct total", () => {
      const result = cells(
        input({
          facts: [
            instantFact(1, "100.00"),
            instantFact(1, "100", { accessionNumber: "0000000001-26-000002" }),
          ],
        }),
      );
      expect(result[metric]).toMatchObject({
        status: "available",
        value: "100",
      });
      expect(result[metric].sources).toHaveLength(2);
    });

    it("filters and sorts exact amounts, counts duplicate listings and sorts unknowns last", () => {
      const first = identity("ALPHA", 1);
      const companies = [
        first,
        { ...first, symbol: "ALPHA.B", listingId: "listing-class-b" },
        identity("BETA", 2),
        identity("MISSING", 3),
      ];
      const source = input({
        facts: [
          instantFact(1, "9007199254740993.0001"),
          instantFact(2, "9007199254740993.0002"),
        ],
      });
      const selected = {
        ...criteria([clause(metric, "gte", "9007199254740993.0001")]),
        sort: { field: metric, direction: "desc" as const },
      };
      expect(validatePersonalFinancialScreenCriteria(selected)).toBe(true);
      const filtered = run(companies, source, selected);
      expect(filtered.rows.map((row) => row.identity.symbol)).toEqual([
        "BETA",
        "ALPHA",
        "ALPHA.B",
      ]);
      expect(filtered).toMatchObject({
        totalUniverse: 4,
        totalMatches: 3,
        totalUnknown: 1,
      });
      expect(filtered.metricCoverage[metric]).toEqual({ known: 3, unknown: 1 });
      for (const direction of ["asc", "desc"] as const) {
        const result = run(companies, source, {
          ...criteria(),
          sort: { field: metric, direction },
        });
        expect(result.rows.at(-1)!.identity.symbol).toBe("MISSING");
      }
    });

    it.each([
      {
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/EUR/CY2025Q4I.json`,
      },
      {
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
      },
      { concept: "StockholdersEquity" },
      { concept: otherConcept },
      { facts: [instantFact(1, "1", { asOfDate: "2025-02-30" })] },
      { facts: [instantFact(1, "1".repeat(65))] },
    ])("rejects an invalid or substituted direct source %j", (patch) => {
      const source = replaceTotal(
        snapshot(),
        concept,
        patch as Partial<PersonalSecInstantFrameDto>,
      );
      expect(() => run([identity("INVALID", 1)], source)).toThrow(
        "Personal financial screen request is invalid.",
      );
    });
  });

  it("preserves all eighteen old values, evidence and unknown reasons across total source states", () => {
    const annual = withPriorRevenue(
      snapshot(
        Object.fromEntries(
          CONCEPTS.map((concept) => [concept, [fact(1, "100")]]),
        ),
      ),
      Object.fromEntries(
        PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => [
          concept,
          [priorFact(1, "50")],
        ]),
      ),
    );
    const base = {
      ...annual,
      instantFrames: balances([instantFact(1, "25")], [instantFact(1, "10")])
        .instantFrames,
    };
    const patches: readonly Partial<PersonalSecInstantFrameDto>[] = [
      { facts: [instantFact(1, "-9007199254740993.001")] },
      { status: "upstream_unavailable", facts: [] },
      { facts: [instantFact(1, "100"), instantFact(1, "101")] },
      { facts: [instantFact(1, "100", { asOfDate: "2026-01-01" })] },
    ];
    for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
      for (const source of [
        base,
        snapshot(),
        replaceFrame(base, REVENUE, {
          status: "upstream_unavailable",
          facts: [],
        }),
      ]) {
        const selected = { ...criteria(), revenueBasis };
        const before = run([identity("OLD", 1)], source, selected);
        for (const [, concept] of totals) {
          for (const patch of patches) {
            const after = run(
              [identity("OLD", 1)],
              replaceTotal(source, concept, patch),
              selected,
            );
            for (const metric of oldMetrics) {
              expect(after.rows[0]!.metrics[metric]).toEqual(
                before.rows[0]!.metrics[metric],
              );
              expect(after.metricCoverage[metric]).toEqual(
                before.metricCoverage[metric],
              );
            }
          }
        }
      }
    }
  });
});

describe("fixed Q4 current assets / current liabilities", () => {
  const cells = (input: PersonalSecFinancialSnapshotDto) =>
    run([identity("LIQUID", 1)], input).rows[0]!.metrics;

  it("registers three instant fields and a distinct multiple formula without changing annual concepts", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS.slice(13, 16)).toEqual([
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
    ]);
    expect(PERSONAL_SEC_ANNUAL_CONCEPTS).toEqual(CONCEPTS);
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.currentRatio).toEqual({
      formulaId: "current_assets_to_current_liabilities",
      formulaVersion: "1.0.0",
      expression: "current_assets / current_liabilities",
    });
    const result = run(
      [identity("LIQUID", 1)],
      balances([instantFact(1, "25")], [instantFact(1, "10")]),
    );
    expect(result).toMatchObject({
      schemaVersion: "10.0.0",
      instantQuarter: 4,
      formulaVersion: "1.7.0",
    });
    expect(result.sources).toHaveLength(12);
    expect(result.rows[0]!.metrics.currentRatio).toEqual({
      status: "available",
      unit: "multiple",
      value: "2.50",
      sources: [
        {
          concept: "AssetsCurrent",
          accessionNumber: "0000000001-26-000001",
          asOfDate: "2025-12-31",
          value: "25",
        },
        {
          concept: "LiabilitiesCurrent",
          accessionNumber: "0000000001-26-000001",
          asOfDate: "2025-12-31",
          value: "10",
        },
      ],
    });
  });

  it.each([
    ["1", "3", "0.33"],
    ["2", "3", "0.67"],
    ["0.995", "1", "1.00"],
    ["1.005", "1", "1.01"],
    ["0.004999", "1", "0.00"],
    ["0.005", "1", "0.01"],
    ["-0.000", "5", "0.00"],
    ["0", "5", "0.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(62)}.00`,
    ],
  ])(
    "divides %s by %s exactly and rounds the multiple to %s",
    (assets, liabilities, expected) => {
      const result = cells(
        balances([instantFact(1, assets)], [instantFact(1, liabilities)]),
      );
      expect(result.currentRatio).toMatchObject({
        status: "available",
        unit: "multiple",
        value: expected,
      });
      expect(expected.length).toBeLessThanOrEqual(129);
    },
  );

  it.each(["2025-10-01", "2025-12-30", "2025-12-31"])(
    "admits the actual in-window balance date %s",
    (asOfDate) => {
      expect(
        cells(
          balances(
            [instantFact(1, "1", { asOfDate })],
            [instantFact(1, "1", { asOfDate })],
          ),
        ).currentRatio,
      ).toMatchObject({ status: "available", value: "1.00" });
    },
  );
  it.each(["2024-12-31", "2025-09-30", "2026-01-01", "2026-01-31"])(
    "retains the actual date %s while rejecting its applicability",
    (asOfDate) => {
      const result = cells(
        balances(
          [instantFact(1, "1", { asOfDate })],
          [instantFact(1, "1", { asOfDate })],
        ),
      );
      for (const key of [
        "currentAssets",
        "currentLiabilities",
        "currentRatio",
      ] as const) {
        expect(result[key]).toMatchObject({
          status: "unavailable",
          reason: "unsupported_balance_date",
        });
        expect(
          result[key].sources.every((ref) => ref.asOfDate === asOfDate),
        ).toBe(true);
      }
    },
  );

  it.each(["0", "-0", "-10"])(
    "retains reported liabilities %s but rejects a nonpositive denominator",
    (value) => {
      const result = cells(
        balances([instantFact(1, "-1")], [instantFact(1, value)]),
      );
      expect(result.currentLiabilities.status).toBe("available");
      expect(result.currentAssets).toMatchObject({
        status: "available",
        value: "-1",
      });
      expect(result.currentRatio).toMatchObject({
        status: "unavailable",
        reason: "nonpositive_current_liabilities",
      });
    },
  );
  it("keeps negative assets visible and does not convert their sign for the ratio", () => {
    const result = cells(
      balances([instantFact(1, "-1")], [instantFact(1, "2")]),
    );
    expect(result.currentAssets).toMatchObject({
      status: "available",
      value: "-1",
    });
    expect(result.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
  });
  it("requires the same actual date before filing and sign checks", () => {
    const result = cells(
      balances(
        [instantFact(1, "-1", { asOfDate: "2025-10-01" })],
        [instantFact(1, "0", { accessionNumber: "0000000001-26-000002" })],
      ),
    );
    expect(result.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "balance_date_mismatch",
    });
    expect(result.currentRatio.sources).toHaveLength(2);
  });
  it("checks every retained accession before signs, including agreeing duplicate observations", () => {
    const result = cells(
      balances(
        [
          instantFact(1, "-1"),
          instantFact(1, "-1", { accessionNumber: "0000000001-26-000002" }),
        ],
        [instantFact(1, "0")],
      ),
    );
    expect(result.currentAssets.status).toBe("available");
    expect(result.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "filing_mismatch",
    });
    expect(result.currentRatio.sources).toHaveLength(3);
  });
  it.each([
    ["invalid_value", [instantFact(1, "bad", { asOfDate: "2025-09-30" })]],
    [
      "conflicting",
      [
        instantFact(1, "1", { asOfDate: "2025-09-30" }),
        instantFact(1, "2", { asOfDate: "2025-09-30" }),
      ],
    ],
    [
      "conflicting",
      [instantFact(1, "1", { asOfDate: "2025-10-01" }), instantFact(1, "1")],
    ],
  ] as const)(
    "resolves %s before the balance-window check",
    (reason, assets) => {
      const result = cells(balances(assets, [instantFact(1, "1")]));
      expect(result.currentAssets).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(result.currentRatio).toMatchObject({
        status: "unavailable",
        reason,
      });
    },
  );
  it("resolves liabilities unavailable before assets, preserving every available operand reference", () => {
    const input = balances([instantFact(1, "bad")], []);
    expect(cells(input).currentRatio).toMatchObject({
      status: "unavailable",
      reason: "missing",
      sources: [{ value: "bad" }],
    });
    const conflict = {
      ...input,
      instantFrames: input.instantFrames.map((frame) =>
        frame.concept === "LiabilitiesCurrent"
          ? { ...frame, unknownCiks: [cik(1)] }
          : frame,
      ),
    };
    expect(cells(conflict).currentRatio).toMatchObject({
      status: "unavailable",
      reason: "conflicting",
    });
  });
  it.each([
    "not_covered",
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "isolates %s instant sources from all twelve annual metrics and revenue bases",
    (status) => {
      const base = snapshot(
        Object.fromEntries(
          CONCEPTS.map((concept) => [concept, [fact(1, "100")]]),
        ),
      );
      const input = {
        ...base,
        instantFrames: base.instantFrames.map((frame) => ({
          ...frame,
          status,
        })),
      };
      for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
        const filters = { ...criteria(), revenueBasis };
        const before = run([identity("LIQUID", 1)], base, filters);
        const after = run([identity("LIQUID", 1)], input, filters);
        for (const metric of PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS) {
          expect(after.rows[0]!.metrics[metric]).toEqual(
            before.rows[0]!.metrics[metric],
          );
          expect(after.metricCoverage[metric]).toEqual(
            before.metricCoverage[metric],
          );
        }
        expect(after.rows[0]!.metrics.currentRatio).toMatchObject({
          status: "unavailable",
          reason: status === "not_covered" ? "missing" : "source_unavailable",
        });
      }
    },
  );
  it("binds operands by CIK, counts duplicate listings and sorts known values before unknowns across pages", () => {
    const companies = [
      identity("BETA", 2),
      { ...identity("ALPHA.B", 1), listingId: "listing-0000000001-b" },
      identity("ALPHA", 1),
      identity("MISSING", 3),
    ];
    const input = balances(
      [instantFact(1, "0.995"), instantFact(2, "2"), instantFact(3, "2")],
      [instantFact(1, "1"), instantFact(2, "1")],
    );
    for (const direction of ["asc", "desc"] as const) {
      const filters = {
        ...criteria(),
        sort: { field: "currentRatio" as const, direction },
      };
      const all = run(companies, input, filters);
      const pages = [0, 2].flatMap((offset) =>
        run(companies, input, filters, { offset, limit: 2 }).rows.map(
          (row) => row.identity.symbol,
        ),
      );
      expect(pages).toEqual(all.rows.map((row) => row.identity.symbol));
      expect(pages.at(-1)).toBe("MISSING");
      expect(all.metricCoverage.currentRatio).toEqual({ known: 3, unknown: 1 });
    }
    const inclusive = run(
      companies,
      input,
      criteria([
        clause("currentRatio", "gte", "1.00"),
        clause("currentRatio", "lte", "1.00"),
      ]),
    );
    expect(inclusive.rows.map((row) => row.identity.symbol)).toEqual([
      "ALPHA",
      "ALPHA.B",
    ]);
    expect(inclusive).toMatchObject({
      totalMatches: 2,
      totalNonMatches: 1,
      totalUnknown: 1,
    });
    expect(
      run(
        companies,
        input,
        criteria([clause("currentRatio", "gte", "1.01")]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["BETA"]);
  });
  it("rejects quarter injection in saved criteria and corrupted instant selection/shape before evaluation", () => {
    expect(
      validatePersonalFinancialScreenCriteria({
        ...criteria(),
        instantQuarter: 4,
      }),
    ).toBe(false);
    const good = balances([instantFact(1, "1")], [instantFact(1, "1")]);
    const mutations: unknown[] = [
      { ...good, instantQuarter: 3 },
      { ...good, instantFrames: [] },
      {
        ...good,
        instantFrames: [good.instantFrames[0], good.instantFrames[0]],
      },
      {
        ...good,
        instantFrames: good.instantFrames.map((frame) => ({
          ...frame,
          sourceUrl: frame.sourceUrl.replace("Q4I", "Q3I"),
        })),
      },
      {
        ...good,
        instantFrames: good.instantFrames.map((frame) => ({
          ...frame,
          facts: [{ ...instantFact(1, "1"), startDate: "2025-01-01" }],
        })),
      },
      ...["2025-02-29", "2023-12-31", "2027-01-01"].map((asOfDate) =>
        balances([instantFact(1, "1", { asOfDate })], []),
      ),
    ];
    for (const bad of mutations)
      expect(() => run([], bad as PersonalSecFinancialSnapshotDto)).toThrow(
        "Personal financial screen request is invalid.",
      );
  });
});

describe("fixed Q4 current assets less current liabilities", () => {
  const metric = "currentAssetsLessCurrentLiabilities";
  const cells = (input: PersonalSecFinancialSnapshotDto) =>
    run([identity("BALANCE", 1)], input).rows[0]!.metrics;

  it("adds one USD subtraction using only the existing instant source concepts", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS).toEqual([
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
      metric,
      "totalAssets",
      "totalLiabilities",
    ]);
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toHaveLength(20);
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[metric]).toEqual({
      formulaId: "current_assets_less_current_liabilities",
      formulaVersion: "1.0.0",
      expression: "current_assets - current_liabilities",
    });
    expect(PERSONAL_SEC_INSTANT_CONCEPTS).toEqual([
      "AssetsCurrent",
      "LiabilitiesCurrent",
      "Assets",
      "Liabilities",
    ]);
    const input = balances([instantFact(1, "25")], [instantFact(1, "10")]);
    const result = run([identity("BALANCE", 1)], input);
    expect(result).toMatchObject({
      schemaVersion: "10.0.0",
      formulaVersion: "1.7.0",
      instantQuarter: 4,
    });
    expect(result.sources).toHaveLength(12);
    expect(result.priorRevenueSources).toHaveLength(3);
    expect(result.rows[0]!.metrics[metric]).toEqual({
      status: "available",
      unit: "USD",
      value: "15",
      sources: [
        ...result.rows[0]!.metrics.currentAssets.sources,
        ...result.rows[0]!.metrics.currentLiabilities.sources,
      ],
    });
  });

  it.each([
    ["25", "10", "15"],
    ["10", "25", "-15"],
    ["5.000", "5", "0"],
    ["0", "0", "0"],
    ["-0.000", "0", "0"],
    ["0", "0.001", "-0.001"],
    [
      "100.1234567890123456789",
      "0.0000000000000000001",
      "100.1234567890123456788",
    ],
    ["9007199254740993.00000001", "9007199254740993", "0.00000001"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(63)}8.${"9".repeat(62)}`,
    ],
    [
      `0.${"0".repeat(61)}1`,
      "9".repeat(64),
      `-${"9".repeat(63)}8.${"9".repeat(62)}`,
    ],
  ])("subtracts %s less %s exactly as %s", (assets, liabilities, expected) => {
    const result = cells(
      balances([instantFact(1, assets)], [instantFact(1, liabilities)]),
    );
    expect(result[metric]).toMatchObject({
      status: "available",
      unit: "USD",
      value: expected,
    });
    expect(result[metric].sources.map((source) => source.value)).toEqual([
      assets,
      liabilities,
    ]);
    expect(expected.length).toBeLessThanOrEqual(128);
  });

  it("allows zero liabilities for subtraction while leaving the existing ratio unavailable", () => {
    const result = cells(
      balances([instantFact(1, "9.5")], [instantFact(1, "-0.000")]),
    );
    expect(result[metric]).toMatchObject({ status: "available", value: "9.5" });
    expect(result.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "nonpositive_current_liabilities",
    });
  });

  it.each(["2025-10-01", "2025-12-31"])(
    "accepts the shared Q4 boundary %s",
    (asOfDate) => {
      expect(
        cells(
          balances(
            [instantFact(1, "2", { asOfDate })],
            [instantFact(1, "3", { asOfDate })],
          ),
        )[metric],
      ).toMatchObject({ status: "available", value: "-1" });
    },
  );

  it.each(["2024-12-31", "2025-09-30", "2026-01-01", "2026-01-31"])(
    "retains but does not subtract the out-of-window date %s",
    (asOfDate) => {
      const result = cells(
        balances(
          [instantFact(1, "2", { asOfDate })],
          [instantFact(1, "3", { asOfDate })],
        ),
      )[metric];
      expect(result).toMatchObject({
        status: "unavailable",
        unit: "USD",
        reason: "unsupported_balance_date",
      });
      expect(result.sources).toHaveLength(2);
      expect(
        result.sources.every((source) => source.asOfDate === asOfDate),
      ).toBe(true);
    },
  );

  it.each([
    ["-1", "2"],
    ["2", "-1"],
    ["-1", "-2"],
  ])(
    "preserves signed reported balances %s / %s but excludes negative operands",
    (assets, liabilities) => {
      const result = cells(
        balances([instantFact(1, assets)], [instantFact(1, liabilities)]),
      );
      expect(result.currentAssets).toMatchObject({
        status: "available",
        value: assets,
      });
      expect(result.currentLiabilities).toMatchObject({
        status: "available",
        value: liabilities,
      });
      expect(result[metric]).toMatchObject({
        status: "unavailable",
        reason: "unsupported_sign",
        sources: [{ value: assets }, { value: liabilities }],
      });
    },
  );

  it("checks shared actual dates before filing and operand signs", () => {
    const result = cells(
      balances(
        [instantFact(1, "-1", { asOfDate: "2025-10-01" })],
        [instantFact(1, "-2", { accessionNumber: "0000000001-26-000002" })],
      ),
    );
    expect(result[metric]).toMatchObject({
      status: "unavailable",
      reason: "balance_date_mismatch",
    });
    expect(result[metric].sources).toHaveLength(2);
  });

  it("retains every agreeing duplicate from both inputs", () => {
    const result = cells(
      balances(
        [instantFact(1, "25"), instantFact(1, "25.00")],
        [instantFact(1, "10"), instantFact(1, "10.000")],
      ),
    );
    expect(result[metric]).toEqual({
      status: "available",
      unit: "USD",
      value: "15",
      sources: [
        ...result.currentAssets.sources,
        ...result.currentLiabilities.sources,
      ],
    });
    expect(result[metric].sources).toHaveLength(4);
  });

  it.each(["assets", "liabilities"] as const)(
    "rejects a later %s reference from another filing before signs",
    (operand) => {
      const refs = [
        instantFact(1, "-1"),
        instantFact(1, "-1", { accessionNumber: "0000000001-26-000002" }),
      ];
      const result = cells(
        balances(
          operand === "assets" ? refs : [instantFact(1, "2")],
          operand === "liabilities" ? refs : [instantFact(1, "2")],
        ),
      );
      expect(result[metric]).toMatchObject({
        status: "unavailable",
        reason: "filing_mismatch",
      });
      expect(result[metric].sources).toHaveLength(3);
    },
  );

  it.each([
    ["invalid_value", [instantFact(1, "bad", { asOfDate: "2025-09-30" })]],
    [
      "conflicting",
      [instantFact(1, "1"), instantFact(1, "2", { asOfDate: "2025-09-30" })],
    ],
    [
      "conflicting",
      [instantFact(1, "1"), instantFact(1, "1", { asOfDate: "2025-09-30" })],
    ],
  ] as const)(
    "preserves %s input precedence including a bad later reference",
    (reason, refs) => {
      for (const operand of ["assets", "liabilities"] as const) {
        const result = cells(
          balances(
            operand === "assets" ? refs : [instantFact(1, "2")],
            operand === "liabilities" ? refs : [instantFact(1, "2")],
          ),
        );
        expect(result[metric]).toMatchObject({ status: "unavailable", reason });
        expect(result[metric].sources).toHaveLength(refs.length + 1);
      }
    },
  );

  it("resolves assets unavailable before liabilities while preserving the ratio's original precedence", () => {
    const result = cells(balances([instantFact(1, "bad")], []));
    expect(result[metric]).toEqual({
      status: "unavailable",
      unit: "USD",
      reason: "invalid_value",
      sources: result.currentAssets.sources,
    });
    expect(result.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "missing",
    });
    const missingAssets = cells(balances([], [instantFact(1, "bad")]));
    expect(missingAssets[metric]).toMatchObject({
      status: "unavailable",
      reason: "missing",
      sources: [{ value: "bad" }],
    });
  });

  it.each(["AssetsCurrent", "LiabilitiesCurrent"] as const)(
    "propagates each %s source state without substituting zero",
    (concept) => {
      const input = balances([instantFact(1, "2")], [instantFact(1, "3")]);
      for (const status of [
        "not_covered",
        "rate_limited",
        "upstream_unavailable",
        "invalid_response",
      ] as const) {
        const result = cells({
          ...input,
          instantFrames: input.instantFrames.map((frame) =>
            frame.concept === concept ? { ...frame, status, facts: [] } : frame,
          ),
        });
        expect(result[metric]).toMatchObject({
          status: "unavailable",
          reason: status === "not_covered" ? "missing" : "source_unavailable",
        });
        expect(result[metric].sources).toHaveLength(1);
      }
      const result = cells({
        ...input,
        instantFrames: input.instantFrames.map((frame) =>
          frame.concept === concept
            ? { ...frame, unknownCiks: [cik(1)] }
            : frame,
        ),
      });
      expect(result[metric]).toMatchObject({
        status: "unavailable",
        reason: "conflicting",
      });
      expect(result[metric].sources).toHaveLength(2);
    },
  );

  it("supports exact signed criteria, stable sorting and listing coverage through serialized criteria", () => {
    const companies = [
      identity("POSITIVE", 2),
      identity("SHORTFALL", 1),
      { ...identity("SHORTFALL.B", 1), listingId: "listing-0000000001-b" },
      identity("ZERO", 3),
      identity("MISSING", 4),
    ];
    const input = balances(
      [
        instantFact(1, "0.995"),
        instantFact(2, "3"),
        instantFact(3, "0"),
        instantFact(4, "5"),
      ],
      [instantFact(1, "1"), instantFact(2, "1"), instantFact(3, "0")],
    );
    for (const direction of ["asc", "desc"] as const) {
      const filters: PersonalFinancialScreenCriteriaDto = {
        ...criteria(),
        sort: { field: metric, direction },
      };
      const all = run(companies, input, filters);
      const pages = [0, 2, 4].flatMap((offset) =>
        run(companies, input, filters, { offset, limit: 2 }).rows.map(
          (row) => row.identity.symbol,
        ),
      );
      expect(pages).toEqual(
        direction === "asc"
          ? ["SHORTFALL", "SHORTFALL.B", "ZERO", "POSITIVE", "MISSING"]
          : ["POSITIVE", "ZERO", "SHORTFALL", "SHORTFALL.B", "MISSING"],
      );
      expect(all.metricCoverage[metric]).toEqual({ known: 4, unknown: 1 });
    }
    const saved = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        criteria: {
          ...criteria([
            clause(metric, "gte", "-0.005"),
            clause(metric, "lte", "-0.005"),
          ]),
          sort: { field: metric, direction: "desc" },
        },
      }),
    ) as {
      schemaVersion: number;
      criteria: PersonalFinancialScreenCriteriaDto;
    };
    expect(saved.schemaVersion).toBe(1);
    expect(validatePersonalFinancialScreenCriteria(saved.criteria)).toBe(true);
    const result = run(companies, input, saved.criteria);
    expect(result.rows.map((row) => row.identity.symbol)).toEqual([
      "SHORTFALL",
      "SHORTFALL.B",
    ]);
    expect(result).toMatchObject({
      totalMatches: 2,
      totalNonMatches: 2,
      totalUnknown: 1,
    });
    expect(
      run(
        companies,
        input,
        criteria([clause(metric, "gte", "-0.0049")]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["POSITIVE", "ZERO"]);
  });

  it("leaves the sixteen existing values intact across every revenue basis and annual source failure", () => {
    const annual = withPriorRevenue(
      snapshot(
        Object.fromEntries(
          CONCEPTS.map((concept) => [concept, [fact(1, "100")]]),
        ),
      ),
      Object.fromEntries(
        PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => [
          concept,
          [priorFact(1, "50")],
        ]),
      ),
    );
    const input = {
      ...annual,
      instantFrames: balances([instantFact(1, "25")], [instantFact(1, "10")])
        .instantFrames,
    };
    const expected = {
      revenue: "100",
      grossProfit: "100",
      netIncome: "100",
      operatingIncome: "100",
      operatingCashFlow: "100",
      netMargin: "100.00",
      operatingMargin: "100.00",
      operatingCashFlowMargin: "100.00",
      ppePurchases: "100",
      operatingCashFlowLessPpePurchases: "0",
      grossMargin: "100.00",
      operatingCashFlowToNetIncome: "100.00",
      currentAssets: "25",
      currentLiabilities: "10",
      currentRatio: "2.50",
      revenueGrowth: "100.00",
    };
    for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
      const result = run([identity("BALANCE", 1)], input, {
        ...criteria(),
        revenueBasis,
      }).rows[0]!.metrics;
      for (const [key, value] of Object.entries(expected))
        expect(result[key as PersonalFinancialScreenMetricDto]).toMatchObject({
          status: "available",
          value,
        });
      expect(result[metric]).toMatchObject({
        status: "available",
        value: "15",
      });
      for (const concept of CONCEPTS) {
        const failed = run(
          [identity("BALANCE", 1)],
          replaceFrame(input, concept, {
            status: "upstream_unavailable",
            facts: [],
          }),
          { ...criteria(), revenueBasis },
        ).rows[0]!.metrics;
        expect(failed[metric]).toEqual(result[metric]);
        for (const key of [
          "currentAssets",
          "currentLiabilities",
          "currentRatio",
        ] as const)
          expect(failed[key]).toEqual(result[key]);
      }
    }
  });
});

function instantFact(
  index: number,
  value: string,
  overrides: Partial<PersonalSecInstantFactDto> = {},
): PersonalSecInstantFactDto {
  return {
    cik: cik(index),
    accessionNumber: `${cik(index)}-26-000001`,
    asOfDate: "2025-12-31",
    value,
    ...overrides,
  };
}
function balances(
  assets: readonly PersonalSecInstantFactDto[],
  liabilities: readonly PersonalSecInstantFactDto[],
): PersonalSecFinancialSnapshotDto {
  const base = snapshot();
  return {
    ...base,
    instantFrames: base.instantFrames.map((frame) => ({
      ...frame,
      facts:
        frame.concept === "AssetsCurrent"
          ? assets
          : frame.concept === "LiabilitiesCurrent"
            ? liabilities
            : [],
    })),
  };
}

function priorFact(
  index: number,
  value: string,
  overrides: Partial<PersonalSecAnnualFactDto> = {},
): PersonalSecAnnualFactDto {
  return fact(index, value, {
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    accessionNumber: `${cik(index)}-25-000001`,
    ...overrides,
  });
}
function withPriorRevenue(
  input: PersonalSecFinancialSnapshotDto,
  values: Partial<
    Record<PersonalSecRevenueConceptDto, readonly PersonalSecAnnualFactDto[]>
  >,
): PersonalSecFinancialSnapshotDto {
  return {
    ...input,
    priorRevenueFrames: input.priorRevenueFrames.map((frame) => ({
      ...frame,
      facts: values[frame.concept] ?? [],
    })),
  };
}
function replacePriorFrame(
  input: PersonalSecFinancialSnapshotDto,
  concept: PersonalSecRevenueConceptDto,
  overrides: Partial<PersonalSecRevenueFrameDto>,
): PersonalSecFinancialSnapshotDto {
  return {
    ...input,
    priorRevenueFrames: input.priorRevenueFrames.map((frame) =>
      frame.concept === concept ? { ...frame, ...overrides } : frame,
    ),
  };
}

describe("selected revenue year-over-year growth", () => {
  const input = (current = "110", prior = "100") =>
    withPriorRevenue(snapshot({ [REVENUE]: [fact(1, current)] }), {
      [REVENUE]: [priorFact(1, prior)],
    });
  const growth = (
    source: PersonalSecFinancialSnapshotDto,
    revenueBasis?: PersonalFinancialRevenueBasisDto,
  ) =>
    run([identity("GROWTH", 1)], source, {
      ...criteria(),
      ...(revenueBasis === undefined ? {} : { revenueBasis }),
    }).rows[0]!.metrics.revenueGrowth;

  it("appends one typed percentage field and retains both source roles with different filings across years", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_GROWTH_METRICS).toEqual(["revenueGrowth"]);
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toHaveLength(20);
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS[19]).toBe("revenueGrowth");
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS.revenueGrowth).toEqual(
      PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.revenueGrowth,
    );
    const result = run([identity("GROWTH", 1)], input());
    const cell = result.rows[0]!.metrics.revenueGrowth;
    expect(result).toMatchObject({
      schemaVersion: "10.0.0",
      formulaVersion: "1.7.0",
      calendarYear: 2025,
      priorCalendarYear: 2024,
    });
    expect(result.sources).toHaveLength(12);
    expect(result.priorRevenueSources).toEqual(
      PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => ({
        concept,
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
      })),
    );
    expect(cell).toEqual({
      status: "available",
      unit: "percent",
      value: "10.00",
      currentRevenue: result.rows[0]!.metrics.revenue,
      priorRevenue: {
        status: "available",
        unit: "USD",
        value: "100",
        sources: [
          {
            concept: REVENUE,
            accessionNumber: "0000000001-25-000001",
            startDate: "2024-01-01",
            endDate: "2024-12-31",
            value: "100",
          },
        ],
      },
      sources: [
        {
          ...result.rows[0]!.metrics.revenue.sources[0]!,
          role: "current_revenue",
          calendarYear: 2025,
        },
        {
          concept: REVENUE,
          accessionNumber: "0000000001-25-000001",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          value: "100",
          role: "prior_revenue",
          calendarYear: 2024,
        },
      ],
    });
  });

  it.each([
    ["101", "100", "1.00"],
    ["100.005", "100", "0.01"],
    ["99.995", "100", "-0.01"],
    ["99.996", "100", "0.00"],
    ["0", "100", "-100.00"],
    ["-0.00", "100", "-100.00"],
    ["-50", "100", "-150.00"],
    ["-0.005", "100", "-100.01"],
    ["1000", "100", "900.00"],
    ["1.000000", "1", "0.00"],
    ["9007199254740991", "0.000001", "900719925474099099999900.00"],
  ])(
    "rounds %s against %s once to %s, retaining signed current amounts",
    (current, prior, expected) => {
      expect(growth(input(current, prior))).toMatchObject({
        status: "available",
        unit: "percent",
        value: expected,
      });
    },
  );

  it.each([false, true])(
    "keeps the full 131-character result for negative=%s",
    (negative) => {
      const current = `${negative ? "-" : ""}${"9".repeat(negative ? 63 : 64)}`;
      const prior = `0.${"0".repeat(61)}1`;
      const expected = `${BigInt(current) * 10n ** 64n - 100n}.00`;
      expect(expected).toHaveLength(131);
      expect(growth(input(current, prior))).toMatchObject({
        status: "available",
        value: expected,
      });
      expect(growth(input(prior, "9".repeat(64)))).toMatchObject({
        value: "-100.00",
      });
    },
  );

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "uses only the chosen %s basis in both years",
    (basis) => {
      const source = withPriorRevenue(
        snapshot({
          [REVENUE]: [fact(1, "110")],
          Revenues: [fact(1, "110")],
          SalesRevenueNet: [fact(1, "110")],
        }),
        {
          [REVENUE]: [priorFact(1, "100")],
          Revenues: [priorFact(1, "100")],
          SalesRevenueNet: [priorFact(1, "100")],
        },
      );
      const cell = growth(source, basis);
      expect(cell).toMatchObject({ status: "available", value: "10.00" });
      expect(cell.currentRevenue.sources).toHaveLength(
        basis === "agreement" ? 3 : 1,
      );
      expect(cell.sources.map((ref) => ref.role)).toEqual([
        ...Array<string>(basis === "agreement" ? 3 : 1).fill("current_revenue"),
        ...Array<string>(basis === "agreement" ? 3 : 1).fill("prior_revenue"),
      ]);
      if (basis !== "agreement")
        expect(cell.sources.every((ref) => ref.concept === basis)).toBe(true);
    },
  );

  it("does not compare changed agreement concept sets or fall back from an explicit missing concept", () => {
    const source = withPriorRevenue(input(), {
      [REVENUE]: [priorFact(1, "100")],
      Revenues: [priorFact(1, "100")],
    });
    expect(growth(source)).toMatchObject({ reason: "concept_set_changed" });
    expect(growth(source, REVENUE)).toMatchObject({ value: "10.00" });
    expect(growth(source, "Revenues")).toMatchObject({
      reason: "current_unavailable",
      currentRevenue: { reason: "missing" },
    });
    expect(growth(source, "SalesRevenueNet")).toMatchObject({
      reason: "prior_unavailable",
      priorRevenue: { reason: "missing" },
    });
  });

  it.each([
    "not_covered",
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "preserves the selected and agreement semantics of prior source %s",
    (status) => {
      const source = replacePriorFrame(input(), "SalesRevenueNet", { status });
      expect(growth(source)).toMatchObject(
        status === "not_covered"
          ? { value: "10.00" }
          : {
              reason: "prior_unavailable",
              priorRevenue: { reason: "source_unavailable" },
            },
      );
      expect(growth(source, REVENUE)).toMatchObject({ value: "10.00" });
      expect(growth(source, "SalesRevenueNet")).toMatchObject({
        reason: "prior_unavailable",
        priorRevenue: {
          reason: status === "not_covered" ? "missing" : "source_unavailable",
        },
      });
    },
  );

  it("keeps prior-first unavailable reasons and retained evidence, including invalid and quarantined values", () => {
    const failedBoth = replaceFrame(
      replacePriorFrame(input(), REVENUE, {
        status: "upstream_unavailable",
        facts: [],
      }),
      REVENUE,
      { status: "rate_limited", facts: [] },
    );
    expect(growth(failedBoth)).toMatchObject({
      reason: "prior_unavailable",
      priorRevenue: { reason: "source_unavailable" },
      currentRevenue: { reason: "source_unavailable" },
      sources: [],
    });
    expect(growth(replaceFrame(input(), REVENUE, { facts: [] }))).toMatchObject(
      {
        reason: "current_unavailable",
        currentRevenue: { reason: "missing" },
        priorRevenue: { value: "100" },
        sources: [{ role: "prior_revenue" }],
      },
    );
    expect(growth(input("110", "NaN"))).toMatchObject({
      reason: "prior_unavailable",
      priorRevenue: { reason: "invalid_value", sources: [{ value: "NaN" }] },
    });
    expect(
      growth(replacePriorFrame(input(), "Revenues", { unknownCiks: [cik(1)] })),
    ).toMatchObject({
      reason: "prior_unavailable",
      priorRevenue: {
        reason: "conflicting",
        sources: [{ concept: REVENUE, value: "100" }],
      },
    });
    expect(
      growth(withPriorRevenue(input(), { [REVENUE]: [priorFact(2, "100")] })),
    ).toMatchObject({
      reason: "prior_unavailable",
      priorRevenue: { reason: "missing" },
    });
  });

  it.each(["current", "prior"] as const)(
    "checks every %s reference before accepting agreement",
    (period) => {
      const altered =
        period === "current"
          ? replaceFrame(input(), "Revenues", {
              facts: [fact(1, "110", { startDate: "2025-01-02" })],
            })
          : replacePriorFrame(input(), "Revenues", {
              facts: [priorFact(1, "101")],
            });
      expect(growth(altered)).toMatchObject({
        reason:
          period === "current" ? "current_unavailable" : "prior_unavailable",
        [period === "current" ? "currentRevenue" : "priorRevenue"]: {
          reason: "conflicting",
        },
      });
    },
  );

  it.each([
    ["2025-11-30", "period_mismatch"],
    ["2025-12-01", "available"],
    ["2026-01-30", "available"],
    ["2026-01-31", "period_mismatch"],
  ])(
    "applies the inclusive annual duration rule for current end %s",
    (endDate, expected) => {
      const cell = growth(
        replaceFrame(input(), REVENUE, {
          facts: [fact(1, "110", { endDate })],
        }),
      );
      expect(cell.status === "available" ? cell.status : cell.reason).toBe(
        expected,
      );
    },
  );

  it("accepts adjacent 52/53-week periods while retaining their different lengths", () => {
    const source = withPriorRevenue(
      snapshot({
        [REVENUE]: [
          fact(1, "110", { startDate: "2024-12-29", endDate: "2026-01-03" }),
        ],
      }),
      {
        [REVENUE]: [
          priorFact(1, "100", {
            startDate: "2023-12-31",
            endDate: "2024-12-28",
          }),
        ],
      },
    );
    expect(growth(source)).toMatchObject({
      value: "10.00",
      currentRevenue: {
        sources: [{ startDate: "2024-12-29", endDate: "2026-01-03" }],
      },
      priorRevenue: {
        sources: [{ startDate: "2023-12-31", endDate: "2024-12-28" }],
      },
    });
  });

  it("retains a structurally valid one-day prior fact as a period mismatch", () => {
    const source = withPriorRevenue(input(), {
      [REVENUE]: [priorFact(1, "100", { startDate: "2024-12-31" })],
    });
    expect(growth(source)).toMatchObject({
      status: "unavailable",
      reason: "period_mismatch",
      currentRevenue: { status: "available", value: "110" },
      priorRevenue: {
        status: "available",
        value: "100",
        sources: [{ startDate: "2024-12-31", endDate: "2024-12-31" }],
      },
    });
  });

  it.each(["2024-12-31", "2025-01-02"])(
    "keeps overlaps/gaps unknown at current start %s",
    (startDate) => {
      expect(
        growth(
          replaceFrame(input(), REVENUE, {
            facts: [fact(1, "110", { startDate })],
          }),
        ),
      ).toMatchObject({ reason: "nonadjacent_periods" });
    },
  );

  it("checks each requested Frame year independently of adjacency", () => {
    const source = withPriorRevenue(
      snapshot({
        [REVENUE]: [
          fact(1, "110", { startDate: "2022-01-01", endDate: "2022-12-31" }),
        ],
      }),
      {
        [REVENUE]: [
          priorFact(1, "100", {
            startDate: "2021-01-01",
            endDate: "2021-12-31",
          }),
        ],
      },
    );
    expect(growth(source)).toMatchObject({ reason: "period_mismatch" });
  });

  it.each(["0", "-100"])(
    "requires positive prior revenue without hiding its reported %s amount",
    (value) => {
      expect(growth(input("110", value))).toMatchObject({
        reason: "nonpositive_prior_revenue",
        priorRevenue: { status: "available", value },
      });
    },
  );

  it.each(["current", "prior"] as const)(
    "requires one filing within the %s year but keeps the reported operand available",
    (period) => {
      const source =
        period === "current"
          ? replaceFrame(input(), REVENUE, {
              facts: [
                fact(1, "110"),
                fact(1, "110.00", { accessionNumber: "0000000001-26-000002" }),
              ],
            })
          : replacePriorFrame(input(), REVENUE, {
              facts: [
                priorFact(1, "100"),
                priorFact(1, "100.00", {
                  accessionNumber: "0000000001-25-000002",
                }),
              ],
            });
      expect(growth(source)).toMatchObject({
        reason: "filing_mismatch",
        currentRevenue: { status: "available" },
        priorRevenue: { status: "available" },
      });
      expect(growth(source).sources).toHaveLength(3);
    },
  );

  it("keeps duration, concept continuity, adjacency and positive-base precedence ahead of filing mismatch", () => {
    const mixed = replacePriorFrame(input("110", "0"), REVENUE, {
      facts: [
        priorFact(1, "0"),
        priorFact(1, "0", { accessionNumber: "0000000001-25-000002" }),
      ],
    });
    expect(growth(mixed)).toMatchObject({
      reason: "nonpositive_prior_revenue",
    });
    const gap = replaceFrame(mixed, REVENUE, {
      facts: [fact(1, "110", { startDate: "2025-01-02" })],
    });
    expect(growth(gap)).toMatchObject({ reason: "nonadjacent_periods" });
    const scope = replacePriorFrame(gap, "Revenues", {
      facts: [priorFact(1, "0")],
    });
    expect(growth(scope)).toMatchObject({ reason: "concept_set_changed" });
    const short = replaceFrame(scope, REVENUE, {
      facts: [fact(1, "110", { startDate: "2025-11-01" })],
    });
    expect(growth(short)).toMatchObject({ reason: "period_mismatch" });
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "leaves every existing metric and current source unchanged when prior sources fail under %s",
    (revenueBasis) => {
      const base = {
        ...input(),
        instantFrames: balances([instantFact(1, "25")], [instantFact(1, "10")])
          .instantFrames,
      };
      const baseline = run([identity("GROWTH", 1)], base, {
        ...criteria(),
        revenueBasis,
      });
      const failed = {
        ...base,
        priorRevenueFrames: base.priorRevenueFrames.map((frame) => ({
          ...frame,
          status: "upstream_unavailable" as const,
          facts: [],
          unknownCiks: [],
        })),
      };
      const result = run([identity("GROWTH", 1)], failed, {
        ...criteria(),
        revenueBasis,
      });
      for (const metric of PERSONAL_FINANCIAL_SCREEN_METRICS.slice(0, 15)) {
        expect(result.rows[0]!.metrics[metric]).toEqual(
          baseline.rows[0]!.metrics[metric],
        );
        expect(result.metricCoverage[metric]).toEqual(
          baseline.metricCoverage[metric],
        );
      }
      expect(result.sources).toEqual(baseline.sources);
      expect(result.rows[0]!.metrics.revenueGrowth).toMatchObject({
        reason: "prior_unavailable",
      });
    },
  );

  it("uses rounded signed inclusive thresholds and stable alias-weighted pages with unknowns last", () => {
    const companies = [
      identity("UP", 1),
      { ...identity("UP.B", 1), listingId: "listing-alias" },
      identity("ZERO", 2),
      identity("DOWN", 3),
      identity("MISSING", 4),
      identity("NOBASE", 5),
    ];
    const source = withPriorRevenue(
      snapshot({
        [REVENUE]: [
          fact(1, "100.005"),
          fact(2, "99.996"),
          fact(3, "-50"),
          fact(4, "110"),
          fact(5, "110"),
        ],
      }),
      {
        [REVENUE]: [
          priorFact(1, "100"),
          priorFact(2, "100"),
          priorFact(3, "100"),
          priorFact(5, "0"),
        ],
      },
    );
    const exact = run(
      companies,
      source,
      criteria([
        clause("revenueGrowth", "gte", "0.01"),
        clause("revenueGrowth", "lte", "0.01"),
      ]),
    );
    expect(exact.rows.map((row) => row.identity.symbol)).toEqual([
      "UP",
      "UP.B",
    ]);
    expect(exact).toMatchObject({
      totalMatches: 2,
      totalNonMatches: 2,
      totalUnknown: 2,
    });
    expect(exact.metricCoverage.revenueGrowth).toEqual({
      known: 4,
      unknown: 2,
    });
    expect(
      run(
        companies,
        source,
        criteria([clause("revenueGrowth", "lte", "-150")]),
      ).rows.map((row) => row.identity.symbol),
    ).toEqual(["DOWN"]);
    expect(
      run(
        companies,
        source,
        criteria([clause("revenueGrowth", "gte", "0.010001")]),
      ),
    ).toMatchObject({ totalMatches: 0, totalNonMatches: 4, totalUnknown: 2 });
    for (const direction of ["asc", "desc"] as const) {
      const sorted = {
        ...criteria(),
        sort: { field: "revenueGrowth" as const, direction },
      };
      const full = run(companies, source, sorted);
      const pages = [0, 2, 4].map((offset) =>
        run([...companies].reverse(), source, sorted, { offset, limit: 2 }),
      );
      expect(pages.flatMap((page) => page.rows)).toEqual(full.rows);
      expect(full.rows.map((row) => row.identity.symbol)).toEqual(
        direction === "asc"
          ? ["DOWN", "ZERO", "UP", "UP.B", "MISSING", "NOBASE"]
          : ["UP", "UP.B", "ZERO", "DOWN", "MISSING", "NOBASE"],
      );
      expect(pages.map((page) => page.hasMore)).toEqual([true, true, false]);
      for (const page of pages)
        expect(page.metricCoverage.revenueGrowth).toEqual({
          known: 4,
          unknown: 2,
        });
    }
    expect(
      run(
        companies,
        source,
        criteria([
          clause("revenueGrowth", "gte", "0"),
          clause("revenue", "lte", "0"),
        ]),
      ),
    ).toMatchObject({ totalMatches: 0, totalNonMatches: 6, totalUnknown: 0 });
  });

  it("keeps the four/five-key criteria grammar and the 2009 selected year with its 2008 comparison", () => {
    const old = { ...criteria(), calendarYear: 2009 };
    const newest = {
      ...old,
      revenueBasis: REVENUE,
      clauses: [clause("revenueGrowth", "gte", "-1")],
      sort: { field: "revenueGrowth", direction: "desc" },
    };
    expect(validatePersonalFinancialScreenCriteria(old)).toBe(true);
    expect(validatePersonalFinancialScreenCriteria(newest)).toBe(true);
    expect(
      validatePersonalFinancialScreenCriteria({
        ...old,
        priorCalendarYear: 2008,
      }),
    ).toBe(false);
    const base = snapshot();
    const source = {
      ...base,
      calendarYear: 2009,
      priorCalendarYear: 2008,
      frames: base.frames.map((frame) => ({
        ...frame,
        sourceUrl: frame.sourceUrl.replace("CY2025", "CY2009"),
      })),
      instantFrames: base.instantFrames.map((frame) => ({
        ...frame,
        sourceUrl: frame.sourceUrl.replace("CY2025", "CY2009"),
      })),
      priorRevenueFrames: base.priorRevenueFrames.map((frame) => ({
        ...frame,
        status: "not_covered" as const,
        sourceUrl: frame.sourceUrl.replace("CY2024", "CY2008"),
      })),
    };
    expect(run([identity("OLDEST", 1)], source, old)).toMatchObject({
      calendarYear: 2009,
      priorCalendarYear: 2008,
      rows: [
        {
          metrics: {
            revenueGrowth: {
              reason: "prior_unavailable",
              priorRevenue: { reason: "missing" },
            },
          },
        },
      ],
    });
  });

  it("rejects missing, swapped, duplicated, wrong-year and non-revenue prior collections without emitting input", () => {
    const good = input();
    const bad: unknown[] = [
      { ...good, priorCalendarYear: 2023 },
      { ...good, priorCalendarYear: "2024" },
      { ...good, priorRevenueFrames: [] },
      { ...good, priorRevenueFrames: undefined },
      {
        ...good,
        priorRevenueFrames: [
          good.priorRevenueFrames[0],
          good.priorRevenueFrames[0],
          good.priorRevenueFrames[2],
        ],
      },
      { ...good, priorRevenueFrames: good.frames.slice(3, 6) },
      {
        ...good,
        priorRevenueFrames: good.priorRevenueFrames.map((frame) => ({
          ...frame,
          sourceUrl: frame.sourceUrl.replace("CY2024", "CY2025"),
        })),
      },
      replacePriorFrame(good, REVENUE, { status: "not_covered" }),
      replacePriorFrame(good, REVENUE, {
        facts: [priorFact(1, "1", { endDate: "2024-02-30" })],
      }),
      replacePriorFrame(good, REVENUE, {
        facts: [priorFact(1, "1".repeat(65))],
      }),
    ];
    for (const source of bad)
      expect(() => run([], source as PersonalSecFinancialSnapshotDto)).toThrow(
        "Personal financial screen request is invalid.",
      );
  });
});
