import { describe, expect, it, vi } from "vitest";

import {
  buildPersonalManualPeerComparison,
  type PersonalManualPeerComparisonInput,
  type PersonalManualPeerComparisonSelection,
} from "./personal-manual-peer-comparison";

const FIELDS = [
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

function selection(suffix: string): PersonalManualPeerComparisonSelection {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: `iss-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityName: `Security ${suffix}`,
    symbol: suffix.toUpperCase().slice(0, 5),
  };
}

function identity(value: PersonalManualPeerComparisonSelection) {
  return {
    country: value.country,
    exchangeMic: value.exchangeMic,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityName: value.securityName,
    symbol: value.symbol,
  };
}

function reported(overrides: Record<string, string | null> = {}) {
  return Object.fromEntries(
    FIELDS.map((field) => {
      const value = field in overrides ? overrides[field] : "10";
      return [
        field,
        value === null
          ? {
              reason: "not_supplied_by_provider",
              status: "unknown",
              value: null,
            }
          : { status: "known", value },
      ];
    }),
  );
}

function annual(
  selected: PersonalManualPeerComparisonSelection,
  years = [
    {
      fiscalYear: 2025,
      reported: reported({
        assets: "100",
        cash: "5",
        current_assets: "30",
        current_liabilities: "20",
        debt: "20",
        free_cash_flow: "10",
        gross_profit: "40",
        net_income: "10",
        operating_income: "20",
        revenue: "100",
      }),
      statementDate: "2026-02-01",
    },
    {
      fiscalYear: 2024,
      reported: reported({ revenue: "80" }),
      statementDate: "2025-02-01",
    },
  ],
) {
  const cells = years.flatMap(({ reported: values }) => Object.values(values));
  const known = cells.filter(
    (cell) => (cell as { status: string }).status === "known",
  ).length;
  const unknown = cells.length - known;
  const latest = years[0]!.fiscalYear;
  const present = new Set(years.map(({ fiscalYear }) => fiscalYear));
  const missing = Array.from(
    { length: 10 },
    (_, index) => latest - index,
  ).filter((year) => !present.has(year));
  return {
    asOf: "2026-08-15T00:00:00.000Z",
    coverage: {
      earliestFiscalYear: years.at(-1)!.fiscalYear,
      knownReportedCells: known,
      latestFiscalYear: latest,
      missingFiscalYears: missing,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
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
    security: identity(selected),
    status: "available",
    years,
  };
}

function point(date: string) {
  const money = (value: string) => ({ status: "known", unit: "USD", value });
  const ratio = (value: string) => ({ status: "known", unit: "ratio", value });
  return {
    date,
    enterpriseValue: money("120"),
    marketCapitalization: money("100"),
    priceToBook: ratio("2"),
    priceToEarnings: ratio("10"),
    trailingPeg1Y: ratio("1"),
  };
}

function valuation(
  selected: PersonalManualPeerComparisonSelection,
  points = [point("2026-08-13"), point("2026-08-14")],
) {
  return {
    asOf: "2026-08-15T00:00:00.000Z",
    coverage: {
      knownCells: points.length * 5,
      observationCount: points.length,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: "2026-08-15",
      latestPoint: points.at(-1),
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
    security: identity(selected),
    status: "available",
  };
}

function company(selected: PersonalManualPeerComparisonSelection) {
  return {
    annualFinancials: annual(selected),
    selection: selected,
    valuationHistory: valuation(selected),
  };
}

function buildHostile(value: unknown) {
  return buildPersonalManualPeerComparison(
    value as PersonalManualPeerComparisonInput,
  );
}

describe("personal manual peer comparison security boundaries", () => {
  it("rejects extra fields, accessors, sparse peers, and more than three peers", () => {
    const primary = company(selection("aaa"));
    expect(() =>
      buildHostile({
        peers: [],
        primary,
        extra: true,
      }),
    ).toThrowError(
      new TypeError("Personal manual peer comparison input is invalid."),
    );
    expect(() =>
      buildHostile({
        peers: [],
        primary: { ...primary, extra: true },
      }),
    ).toThrow(TypeError);
    expect(() =>
      buildHostile({
        peers: [],
        primary: {
          ...primary,
          selection: { ...primary.selection, extra: true },
        },
      }),
    ).toThrow(TypeError);

    let accessed = 0;
    const accessor: unknown = Object.create(Object.prototype, {
      annualFinancials: {
        enumerable: true,
        get() {
          accessed += 1;
          return null;
        },
      },
      selection: { enumerable: true, value: primary.selection },
      valuationHistory: { enumerable: true, value: null },
    });
    expect(() =>
      buildHostile({
        peers: [],
        primary: accessor,
      }),
    ).toThrow(TypeError);
    expect(accessed).toBe(0);

    const sparse: unknown = new Array(1);
    expect(() => buildHostile({ peers: sparse, primary })).toThrow(TypeError);
    const peers = ["b", "c", "d", "e"].map((suffix) =>
      company(selection(suffix)),
    );
    expect(() => buildPersonalManualPeerComparison({ peers, primary })).toThrow(
      TypeError,
    );
  });

  it("requires listing and issuer identities to each be pairwise distinct", () => {
    const primary = company(selection("aaa"));
    const sameListing = company({
      ...selection("bbb"),
      listingId: primary.selection.listingId,
    });
    const sameIssuer = company({
      ...selection("ccc"),
      issuerId: primary.selection.issuerId,
    });
    expect(() =>
      buildPersonalManualPeerComparison({ peers: [sameListing], primary }),
    ).toThrow(TypeError);
    expect(() =>
      buildPersonalManualPeerComparison({ peers: [sameIssuer], primary }),
    ).toThrow(TypeError);
  });

  it("quarantines wrong provider, revision, currency, and response identity by domain", () => {
    const primary = company(selection("aaa"));
    const peerIdentity = selection("bbb");
    const peer = company(peerIdentity);
    (
      peer.annualFinancials.provider as { revisionBasis: string }
    ).revisionBasis = "historical_point_in_time";
    (peer.valuationHistory.security as { symbol: string }).symbol = "WRONG";
    const result = buildPersonalManualPeerComparison({
      peers: [peer],
      primary,
    });

    expect(result.companies[1]?.annual).toEqual({
      issues: [{ reason: "invalid_provider" }],
      status: "quarantined",
    });
    expect(result.companies[1]?.valuation).toEqual({
      issues: [{ reason: "identity_mismatch" }],
      status: "quarantined",
    });
    expect(result.companies[0]?.annual.status).toBe("ready");
    expect(result.companies[0]?.valuation.status).toBe("ready");
  });

  it("rejects a non-string valuation range without invoking coercion hooks", () => {
    const selected = selection("aaa");
    const primary = company(selected);
    let coercions = 0;
    (primary.valuationHistory.history as { range: unknown }).range = {
      toString() {
        coercions += 1;
        return "1m";
      },
    };

    const result = buildPersonalManualPeerComparison({
      peers: [],
      primary,
    });

    expect(coercions).toBe(0);
    expect(result.companies[0]?.valuation).toEqual({
      issues: [{ reason: "invalid_history" }],
      status: "quarantined",
    });
    expect(result.companies[0]?.annual.status).toBe("ready");
  });

  it("never substitutes a nearby fiscal year or valuation date", () => {
    const primary = company(selection("aaa"));
    const peerIdentity = selection("bbb");
    const peerYears = [
      {
        fiscalYear: 2026,
        reported: reported({ revenue: "120" }),
        statementDate: "2026-08-01",
      },
      {
        fiscalYear: 2024,
        reported: reported({ revenue: "80" }),
        statementDate: "2025-02-01",
      },
    ];
    const peer = {
      annualFinancials: annual(peerIdentity, peerYears),
      selection: peerIdentity,
      valuationHistory: valuation(peerIdentity, [
        point("2026-08-13"),
        point("2026-08-15"),
      ]),
    };
    const result = buildPersonalManualPeerComparison({
      peers: [peer],
      primary,
    });

    for (const row of result.rows.filter(({ domain }) => domain === "annual")) {
      expect(row.cells[1]).toMatchObject({
        reason: "exact_fiscal_year_not_found",
        status: "unavailable",
      });
    }
    for (const row of result.rows.filter(
      ({ domain }) => domain === "valuation",
    )) {
      expect(row.cells[1]).toMatchObject({
        reason: "exact_valuation_date_not_found",
        status: "unavailable",
      });
    }
  });

  it("marks nonpositive denominators unavailable without disturbing other cells", () => {
    const selected = selection("aaa");
    const badDenominator = annual(selected, [
      {
        fiscalYear: 2025,
        reported: reported({
          assets: "0",
          current_assets: "30",
          current_liabilities: "0",
          debt: "20",
          revenue: "0",
        }),
        statementDate: "2026-02-01",
      },
      {
        fiscalYear: 2024,
        reported: reported({ revenue: "0" }),
        statementDate: "2025-02-01",
      },
    ]);
    const result = buildPersonalManualPeerComparison({
      peers: [],
      primary: {
        annualFinancials: badDenominator,
        selection: selected,
        valuationHistory: valuation(selected),
      },
    });

    for (const metricId of [
      "revenue_growth",
      "gross_margin",
      "operating_margin",
      "net_margin",
      "free_cash_flow_margin",
      "debt_to_assets",
      "current_ratio",
      "revenue_to_ending_assets",
    ]) {
      expect(
        result.rows.find((row) => row.metricId === metricId)?.cells[0],
        metricId,
      ).toMatchObject({
        reason: "nonpositive_denominator",
        status: "unavailable",
      });
    }
    expect(
      result.rows.find(({ metricId }) => metricId === "net_debt")?.cells[0]
        ?.status,
    ).toBe("available");
  });

  it("quarantines malformed DTOs while remaining network-free and detached from inputs", () => {
    const selected = selection("aaa");
    const primary = company(selected);
    const malformed = structuredClone(primary.annualFinancials);
    malformed.years[0]!.reported.revenue!.value = "01";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = buildPersonalManualPeerComparison({
      peers: [],
      primary: { ...primary, annualFinancials: malformed },
    });
    vi.unstubAllGlobals();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.companies[0]?.annual).toEqual({
      issues: [{ reason: "invalid_periods" }],
      status: "quarantined",
    });
    expect(result.companies[0]?.valuation.status).toBe("ready");
    (primary.selection as { issuerName: string }).issuerName = "Mutated";
    expect(result.companies[0]?.selection.issuerName).toBe("Issuer aaa");
    expect(Object.isFrozen(result.companies[0]?.selection)).toBe(true);
  });
});
