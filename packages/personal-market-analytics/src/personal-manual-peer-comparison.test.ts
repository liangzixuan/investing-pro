import { describe, expect, it } from "vitest";

import {
  PERSONAL_MANUAL_PEER_COMPARISON_LIMITATIONS,
  PERSONAL_MANUAL_PEER_COMPARISON_METRIC_IDS,
  buildPersonalManualPeerComparison,
  type PersonalManualPeerComparisonInput,
  type PersonalManualPeerComparisonSelection,
} from "./personal-manual-peer-comparison";

const FIELD_KEYS = [
  "accounts_receivable",
  "assets",
  "capital_expenditures",
  "cash",
  "cost_of_revenue",
  "current_assets",
  "current_liabilities",
  "debt",
  "depreciation_and_amortization",
  "ebitda",
  "financing_cash_flow",
  "free_cash_flow",
  "gross_profit",
  "income_tax_expense",
  "intangibles",
  "inventory",
  "investing_cash_flow",
  "liabilities",
  "net_income",
  "operating_cash_flow",
  "operating_expenses",
  "operating_income",
  "pretax_income",
  "property_plant_equipment_net",
  "research_and_development",
  "revenue",
  "selling_general_and_administrative",
  "share_based_compensation",
  "shareholders_equity",
  "interest_expense",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

function selection(
  suffix: string,
  symbol: string,
): PersonalManualPeerComparisonSelection {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: `iss-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityName: `${symbol} Common Stock`,
    symbol,
  };
}

function security(value: PersonalManualPeerComparisonSelection) {
  return {
    country: value.country,
    exchangeMic: value.exchangeMic,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityName: value.securityName,
    symbol: value.symbol,
  };
}

function reported(
  values: Partial<Record<FieldKey, string | null>>,
): Record<FieldKey, unknown> {
  return Object.fromEntries(
    FIELD_KEYS.map((key) => {
      const value = values[key] === undefined ? "10" : values[key];
      return [
        key,
        value === null
          ? {
              reason: "not_supplied_by_provider",
              status: "unknown",
              value: null,
            }
          : { status: "known", value },
      ];
    }),
  ) as Record<FieldKey, unknown>;
}

function annual(
  identity: PersonalManualPeerComparisonSelection,
  years: readonly Readonly<{
    fiscalYear: number;
    statementDate: string;
    values: Partial<Record<FieldKey, string | null>>;
  }>[] = [
    {
      fiscalYear: 2025,
      statementDate: "2026-02-01",
      values: {
        assets: "2000",
        cash: "100",
        current_assets: "600",
        current_liabilities: "300",
        debt: "300",
        free_cash_flow: "120",
        gross_profit: "400",
        net_income: "150",
        operating_income: "200",
        revenue: "1000",
      },
    },
    {
      fiscalYear: 2024,
      statementDate: "2025-02-01",
      values: { revenue: "800" },
    },
  ],
) {
  const periods = years.map((year) => ({
    fiscalYear: year.fiscalYear,
    reported: reported(year.values),
    statementDate: year.statementDate,
  }));
  const allCells = periods.flatMap((year) => Object.values(year.reported));
  const known = allCells.filter(
    (cell) => (cell as { status: string }).status === "known",
  ).length;
  const latest = periods[0]!.fiscalYear;
  const present = new Set(periods.map(({ fiscalYear }) => fiscalYear));
  const missing = Array.from(
    { length: 10 },
    (_, index) => latest - index,
  ).filter((year) => !present.has(year));
  const unknown = allCells.length - known;
  return {
    asOf: "2026-08-15T00:00:00.000Z",
    coverage: {
      earliestFiscalYear: periods.at(-1)!.fiscalYear,
      knownReportedCells: known,
      latestFiscalYear: latest,
      missingFiscalYears: missing,
      requestedAnnualYears: 10,
      returnedAnnualYears: periods.length,
      status: missing.length === 0 && unknown === 0 ? "complete" : "partial",
      unknownReportedCells: unknown,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    schemaVersion: "1.1.0",
    security: security(identity),
    status: "available",
    years: periods,
  };
}

function valuationPoint(
  date: string,
  values: Partial<
    Record<
      | "enterpriseValue"
      | "marketCapitalization"
      | "priceToBook"
      | "priceToEarnings"
      | "trailingPeg1Y",
      string | null
    >
  > = {},
) {
  const cell = (key: keyof typeof values, unit: "USD" | "ratio") =>
    values[key] === null
      ? {
          reason: "not_supplied_by_provider",
          status: "unknown",
          unit,
          value: null,
        }
      : { status: "known", unit, value: values[key] ?? "1" };
  return {
    date,
    enterpriseValue: cell("enterpriseValue", "USD"),
    marketCapitalization: cell("marketCapitalization", "USD"),
    priceToBook: cell("priceToBook", "ratio"),
    priceToEarnings: cell("priceToEarnings", "ratio"),
    trailingPeg1Y: cell("trailingPeg1Y", "ratio"),
  };
}

function valuation(
  identity: PersonalManualPeerComparisonSelection,
  points = [
    valuationPoint("2026-08-13"),
    valuationPoint("2026-08-14", {
      enterpriseValue: "5200",
      marketCapitalization: "5000",
      priceToBook: "5",
      priceToEarnings: "20",
      trailingPeg1Y: "1.5",
    }),
  ],
) {
  const known = points
    .flatMap((point) => [
      point.enterpriseValue,
      point.marketCapitalization,
      point.priceToBook,
      point.priceToEarnings,
      point.trailingPeg1Y,
    ])
    .filter((cell) => cell.status === "known").length;
  const unknown = points.length * 5 - known;
  return {
    asOf: "2026-08-15T00:00:00.000Z",
    coverage: {
      knownCells: known,
      observationCount: points.length,
      status: unknown === 0 ? "complete" : "partial",
      unknownCells: unknown,
    },
    history: {
      endDate: "2026-08-15",
      latestPoint: points.at(-1)!,
      points,
      range: "1m",
      startDate: "2026-07-15",
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security: security(identity),
    status: "available",
  };
}

function company(
  identity: PersonalManualPeerComparisonSelection,
  annualFinancials: unknown = annual(identity),
  valuationHistory: unknown = valuation(identity),
) {
  return { annualFinancials, selection: identity, valuationHistory };
}

describe("buildPersonalManualPeerComparison", () => {
  it("builds the fixed 15-row table from exact primary annual and valuation anchors", () => {
    const primary = selection("primary", "AAA");
    const peer = selection("peer", "BBB");
    const peerAnnual = annual(peer, [
      {
        fiscalYear: 2026,
        statementDate: "2026-08-01",
        values: { revenue: "2400" },
      },
      {
        fiscalYear: 2025,
        statementDate: "2026-03-15",
        values: {
          assets: "3000",
          cash: "200",
          current_assets: "900",
          current_liabilities: "300",
          debt: "500",
          free_cash_flow: "200",
          gross_profit: "1000",
          net_income: "240",
          operating_income: "400",
          revenue: "2000",
        },
      },
      {
        fiscalYear: 2024,
        statementDate: "2025-03-15",
        values: { revenue: "1600" },
      },
    ]);
    const peerValuation = valuation(peer, [
      valuationPoint("2026-08-14", {
        enterpriseValue: "10500",
        marketCapitalization: "10000",
        priceToBook: "4",
        priceToEarnings: "25",
        trailingPeg1Y: "2",
      }),
      valuationPoint("2026-08-15", {
        enterpriseValue: "11000",
        marketCapitalization: "10600",
        priceToBook: "4.2",
        priceToEarnings: "26",
        trailingPeg1Y: "2.1",
      }),
    ]);

    const result = buildPersonalManualPeerComparison({
      peers: [company(peer, peerAnnual, peerValuation)],
      primary: company(primary),
    });

    expect(result.anchors).toEqual({
      annualFiscalYear: 2025,
      valuationDate: "2026-08-14",
    });
    expect(result.rows.map(({ metricId }) => metricId)).toEqual(
      PERSONAL_MANUAL_PEER_COMPARISON_METRIC_IDS,
    );
    expect(result.rows).toHaveLength(15);
    expect(
      result.rows.map(({ cells }) =>
        cells.map((cell) =>
          cell.status === "available" ? cell.value : cell.reason,
        ),
      ),
    ).toEqual([
      ["1000.00", "2000.00"],
      ["5000.00", "10000.00"],
      ["5200.00", "10500.00"],
      ["25.00", "25.00"],
      ["40.00", "50.00"],
      ["20.00", "20.00"],
      ["15.00", "12.00"],
      ["12.00", "10.00"],
      ["200.00", "300.00"],
      ["15.00", "16.67"],
      ["2.0000", "3.0000"],
      ["0.5000", "0.6667"],
      ["20.0000", "25.0000"],
      ["5.0000", "4.0000"],
      ["1.5000", "2.0000"],
    ]);
    expect(result.companies[1]?.annual).toMatchObject({
      coordinate: {
        fiscalYear: 2025,
        statementDate: "2026-03-15",
      },
      status: "ready",
    });
    expect(result.companies[1]?.valuation).toMatchObject({
      coordinate: { date: "2026-08-14" },
      status: "ready",
    });
    expect(result.rows[3]?.cells[1]).toMatchObject({
      inputRefs: [
        { fieldKey: "revenue", fiscalYear: 2025, value: "2000" },
        { fieldKey: "revenue", fiscalYear: 2024, value: "1600" },
      ],
    });
  });

  it("keeps independently missing cells and source domains isolated", () => {
    const primary = selection("primary", "AAA");
    const missing = selection("missing", "BBB");
    const quarantined = selection("quarantined", "CCC");
    const sparseAnnual = annual(missing, [
      {
        fiscalYear: 2025,
        statementDate: "2026-02-03",
        values: { gross_profit: null, revenue: "500" },
      },
      {
        fiscalYear: 2023,
        statementDate: "2024-02-03",
        values: { revenue: "400" },
      },
    ]);
    const wrongIdentity = structuredClone(annual(quarantined));
    wrongIdentity.security.symbol = "ZZZ";

    const result = buildPersonalManualPeerComparison({
      peers: [
        company(
          missing,
          sparseAnnual,
          valuation(missing, [valuationPoint("2026-08-15")]),
        ),
        company(quarantined, wrongIdentity, valuation(quarantined)),
      ],
      primary: company(primary),
    });

    expect(result.companies[1]?.annual.status).toBe("ready");
    expect(result.companies[1]?.valuation.status).toBe("ready");
    expect(result.companies[2]?.annual).toEqual({
      issues: [{ reason: "identity_mismatch" }],
      status: "quarantined",
    });
    expect(result.companies[2]?.valuation.status).toBe("ready");
    expect(result.rows[3]?.cells[1]).toMatchObject({
      reason: "exact_prior_fiscal_year_not_found",
      status: "unavailable",
    });
    expect(result.rows[4]?.cells[1]).toMatchObject({
      reason: "missing_input",
      status: "unavailable",
    });
    expect(result.rows[1]?.cells[1]).toMatchObject({
      reason: "exact_valuation_date_not_found",
      status: "unavailable",
    });
    expect(result.rows[0]?.cells[2]).toMatchObject({
      reason: "source_quarantined",
      status: "unavailable",
    });
    expect(result.rows[1]?.cells[2]?.status).toBe("available");
  });

  it("leaves the annual domain unavailable when the primary annual anchor is absent", () => {
    const primary = selection("primary", "AAA");
    const peer = selection("peer", "BBB");
    const result = buildPersonalManualPeerComparison({
      peers: [company(peer)],
      primary: company(primary, null, valuation(primary)),
    });

    expect(result.anchors).toEqual({
      annualFiscalYear: null,
      valuationDate: "2026-08-14",
    });
    expect(result.rows[0]?.cells[0]).toMatchObject({
      reason: "source_not_loaded",
      status: "unavailable",
    });
    expect(result.rows[0]?.cells[1]).toMatchObject({
      reason: "primary_anchor_unavailable",
      status: "unavailable",
    });
    expect(
      result.rows[1]?.cells.every(({ status }) => status === "available"),
    ).toBe(true);
  });

  it("quarantines only a peer valuation domain when its requested range differs", () => {
    const primary = selection("primary", "AAA");
    const peer = selection("peer", "BBB");
    const originalPeerValuation = valuation(peer);
    const peerValuation = {
      ...originalPeerValuation,
      history: {
        ...originalPeerValuation.history,
        range: "ytd",
        startDate: "2026-01-01",
      },
    };

    const result = buildPersonalManualPeerComparison({
      peers: [company(peer, annual(peer), peerValuation)],
      primary: company(primary),
    });

    expect(result.companies[1]?.annual.status).toBe("ready");
    expect(result.companies[1]?.valuation).toEqual({
      issues: [{ reason: "range_mismatch" }],
      status: "quarantined",
    });
    expect(result.rows[0]?.cells[1]?.status).toBe("available");
    expect(result.rows[1]?.cells[1]).toMatchObject({
      reason: "source_quarantined",
      status: "unavailable",
    });
  });

  it("returns a deeply immutable result with only the declared non-ranking limitations", () => {
    const primary = selection("primary", "AAA");
    const input: PersonalManualPeerComparisonInput = {
      peers: [],
      primary: company(primary),
    };
    const result = buildPersonalManualPeerComparison(input);

    expect(result.limitations).toBe(
      PERSONAL_MANUAL_PEER_COMPARISON_LIMITATIONS,
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.rows[0]?.cells[0]?.inputRefs)).toBe(true);
    expect(Object.keys(result)).toEqual([
      "anchors",
      "companies",
      "formulaSetVersion",
      "limitations",
      "rows",
      "schemaVersion",
      "status",
    ]);
  });
});
