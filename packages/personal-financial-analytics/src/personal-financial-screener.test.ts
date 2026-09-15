import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialRevenueBasisDto,
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
      formulaVersion: "1.3.0",
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
      schemaVersion: "5.0.0",
      formulaVersion: "1.3.0",
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
      for (const [metric, cell] of Object.entries(result.rows[0]!.metrics))
        if (metric !== "grossProfit" && metric !== "grossMargin")
          expect(cell.status).toBe("available");
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
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.3.0");
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
        formulaVersion: "1.3.0",
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

describe("gross profit / selected revenue", () => {
  function cells(
    input: PersonalSecAnnualFinancialSnapshotDto,
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
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.3.0");
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
  function cells(input: PersonalSecAnnualFinancialSnapshotDto) {
    return run([identity("CASH", 1)], input).rows[0]!.metrics;
  }

  it("registers a distinct formula while preserving the eleven metrics and every prior formula version", () => {
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS.at(-1)).toBe(metric);
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toHaveLength(12);
    expect(PERSONAL_SEC_ANNUAL_CONCEPTS).toHaveLength(8);
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULAS[metric]).toEqual({
      formulaId: "operating_cash_flow_to_net_income_percent",
      formulaVersion: "1.0.0",
      expression: "operating_cash_flow / net_income * 100",
    });
    expect(PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION).toBe("1.3.0");
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
      PERSONAL_FINANCIAL_SCREEN_METRICS.slice(0, -1),
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
    expect(result.schemaVersion).toBe("5.0.0");
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
