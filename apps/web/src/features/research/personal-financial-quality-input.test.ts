import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import {
  buildPersonalFinancialQualityScorecard,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  type PersonalFinancialQualityScorecardFactKey,
} from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it } from "vitest";

import { mapAnnualFinancials } from "./personal-financial-quality-input";

const currentValues = {
  assets: "2000",
  current_assets: "800",
  current_liabilities: "400",
  debt: "300",
  free_cash_flow: "180",
  gross_profit: "500",
  net_income: "150",
  operating_cash_flow: "240",
  operating_income: "220",
  revenue: "1200",
  shareholders_equity: "1200",
} satisfies Record<PersonalFinancialQualityScorecardFactKey, string>;

const priorValues = {
  assets: "1800",
  current_assets: "700",
  current_liabilities: "350",
  debt: "350",
  free_cash_flow: "140",
  gross_profit: "400",
  net_income: "120",
  operating_cash_flow: "200",
  operating_income: "180",
  revenue: "1000",
  shareholders_equity: "1050",
} satisfies Record<PersonalFinancialQualityScorecardFactKey, string>;

describe("mapAnnualFinancials", () => {
  it("retains exact known decimal lexemes, all periods and each original source coordinate", () => {
    const latest = year(2029, {
      ...currentValues,
      assets: "9007199254740993.1234",
      free_cash_flow: "-0.0000",
      net_income: "-12.3400",
      operating_cash_flow: "0",
    });
    const source = financials([
      latest,
      year(2028, priorValues),
      { ...year(2027, priorValues), statementDate: "2028-01-25" },
    ]);

    const result = mapAnnualFinancials(source);

    expect(result.asOf).toBe(source.asOf);
    expect(
      result.periods.map(({ fiscalYear, statementDate }) => [
        fiscalYear,
        statementDate,
      ]),
    ).toEqual([
      [2029, "2030-02-15"],
      [2028, "2029-02-15"],
      [2027, "2028-01-25"],
    ]);
    expect(result.periods[0]?.facts).toEqual([
      {
        key: "assets",
        sourceRef: "2029:assets",
        unit: "USD",
        value: "9007199254740993.1234",
      },
      {
        key: "current_assets",
        sourceRef: "2029:current_assets",
        unit: "USD",
        value: "800",
      },
      {
        key: "current_liabilities",
        sourceRef: "2029:current_liabilities",
        unit: "USD",
        value: "400",
      },
      { key: "debt", sourceRef: "2029:debt", unit: "USD", value: "300" },
      {
        key: "free_cash_flow",
        sourceRef: "2029:free_cash_flow",
        unit: "USD",
        value: "-0.0000",
      },
      {
        key: "gross_profit",
        sourceRef: "2029:gross_profit",
        unit: "USD",
        value: "500",
      },
      {
        key: "net_income",
        sourceRef: "2029:net_income",
        unit: "USD",
        value: "-12.3400",
      },
      {
        key: "operating_cash_flow",
        sourceRef: "2029:operating_cash_flow",
        unit: "USD",
        value: "0",
      },
      {
        key: "operating_income",
        sourceRef: "2029:operating_income",
        unit: "USD",
        value: "220",
      },
      { key: "revenue", sourceRef: "2029:revenue", unit: "USD", value: "1200" },
      {
        key: "shareholders_equity",
        sourceRef: "2029:shareholders_equity",
        unit: "USD",
        value: "1200",
      },
    ]);
    expect(
      result.periods[2]?.facts.find(({ key }) => key === "revenue"),
    ).toEqual({
      key: "revenue",
      sourceRef: "2027:revenue",
      unit: "USD",
      value: "1000",
    });
    expect(Object.keys(result)).toEqual(["asOf", "periods"]);
  });

  it("matches the real engine's complete twelve-check golden result from independently specified inputs", () => {
    const source = financials([
      year(2029, currentValues),
      year(2028, priorValues),
    ]);
    const expected = buildPersonalFinancialQualityScorecard({
      asOf: "2030-03-01T15:00:00.000Z",
      periods: [
        {
          fiscalYear: 2029,
          statementDate: "2030-02-15",
          facts: directFacts(2029, currentValues),
        },
        {
          fiscalYear: 2028,
          statementDate: "2029-02-15",
          facts: directFacts(2028, priorValues),
        },
      ],
    });
    const result = buildPersonalFinancialQualityScorecard(
      mapAnnualFinancials(source),
    );

    expect(result).toEqual(expected);
    expect(result.status).toBe("ready");
    if (result.status !== "ready")
      throw new Error("Expected ready quality result");
    expect(result.counts).toEqual({
      evaluated: 12,
      met: 12,
      notMet: 0,
      total: 12,
      unavailable: 0,
    });
    expect(
      result.groups.flatMap(({ checks }) =>
        checks.map(({ checkId }) => checkId),
      ),
    ).toEqual(PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS);
  });

  it("omits unknown facts without treating known zero or negative zero as missing", () => {
    const latest = year(2029, {
      ...currentValues,
      net_income: "-0.0000",
      operating_cash_flow: "0",
    });
    const source = financials([
      {
        ...latest,
        reported: {
          ...latest.reported,
          free_cash_flow: {
            reason: "not_supplied_by_provider",
            status: "unknown",
            value: null,
          },
        },
      },
      year(2028, priorValues),
    ]);
    const mapped = mapAnnualFinancials(source);
    expect(mapped.periods[0]?.facts).toHaveLength(10);
    expect(
      mapped.periods[0]?.facts.some(({ key }) => key === "free_cash_flow"),
    ).toBe(false);
    const result = buildPersonalFinancialQualityScorecard(mapped);
    if (result.status !== "ready")
      throw new Error("Expected ready quality result");
    const checks = result.groups.flatMap(({ checks }) => checks);
    expect(
      checks.find(({ checkId }) => checkId === "positive_net_income"),
    ).toMatchObject({ status: "not_met", currentObservation: { value: "0" } });
    expect(
      checks.find(({ checkId }) => checkId === "positive_operating_cash_flow"),
    ).toMatchObject({ status: "not_met", currentObservation: { value: "0" } });
    expect(
      checks.find(({ checkId }) => checkId === "positive_free_cash_flow"),
    ).toMatchObject({ status: "unavailable", reason: "missing_input" });
    expect(
      checks.find(({ checkId }) => checkId === "positive_revenue_growth"),
    ).toMatchObject({ status: "met" });
  });

  it.each([
    ["duplicate_fiscal_year", year(2028, priorValues)],
    ["periods_not_strictly_descending", year(2030, priorValues)],
    [
      "invalid_statement_date",
      { ...year(2027, priorValues), statementDate: "2028-02-30" },
    ],
  ] as const)(
    "keeps a hidden third period so %s remains an engine quarantine",
    (reason, hidden) => {
      const source = financials([
        year(2029, currentValues),
        year(2028, priorValues),
        hidden,
      ]);
      const mapped = mapAnnualFinancials(source);

      expect(mapped.periods.map(({ fiscalYear }) => fiscalYear)).toEqual(
        source.years.map(({ fiscalYear }) => fiscalYear),
      );
      const result = buildPersonalFinancialQualityScorecard(mapped);
      expect(result.status).toBe("quarantined");
      if (result.status !== "quarantined")
        throw new Error("Expected quarantined quality result");
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ index: 2, reason })]),
      );
    },
  );

  it("leaves a nonconsecutive prior year unavailable instead of relabelling or inventing a period", () => {
    const mapped = mapAnnualFinancials(
      financials([year(2029, currentValues), year(2027, priorValues)]),
    );
    expect(mapped.periods.map(({ fiscalYear }) => fiscalYear)).toEqual([
      2029, 2027,
    ]);
    const result = buildPersonalFinancialQualityScorecard(mapped);
    if (result.status !== "ready")
      throw new Error("Expected ready quality result");
    const checks = result.groups.flatMap(({ checks }) => checks);
    expect(
      checks.find(({ checkId }) => checkId === "positive_revenue_growth"),
    ).toMatchObject({
      status: "unavailable",
      reason: "non_consecutive_fiscal_years",
    });
    expect(
      checks.find(({ checkId }) => checkId === "positive_net_income"),
    ).toMatchObject({ status: "met" });
  });

  it("projects fresh records from immutable input without freezing or mutating caller data", () => {
    const source = financials([
      year(2029, currentValues),
      year(2028, priorValues),
    ]);
    const snapshot = structuredClone(source);
    const mutableProjection = mapAnnualFinancials(source);
    mutableProjection.periods[0]!.facts[0]!.value = "999";
    expect(source).toEqual(snapshot);
    expect(Object.isFrozen(source)).toBe(false);

    freezeDeep(source);
    const frozenProjection = mapAnnualFinancials(source);
    expect(frozenProjection.periods).not.toBe(source.years);
    expect(frozenProjection.periods[0]?.facts).not.toBe(
      mutableProjection.periods[0]?.facts,
    );
    expect(frozenProjection.periods[0]?.facts[0]?.value).toBe("2000");
    expect(source).toEqual(snapshot);
    expect(
      buildPersonalFinancialQualityScorecard(frozenProjection).status,
    ).toBe("ready");
  });
});

function directFacts(
  fiscalYear: number,
  values: Readonly<Record<PersonalFinancialQualityScorecardFactKey, string>>,
) {
  return Object.entries(values).map(([key, value]) => ({
    key,
    value,
    unit: "USD",
    sourceRef: `${String(fiscalYear)}:${key}`,
  }));
}

function year(
  fiscalYear: number,
  values: Readonly<
    Partial<Record<PersonalAnnualFinancialReportedFieldKeyDto, string>>
  >,
): PersonalAnnualFinancialsDto["years"][number] {
  return {
    fiscalYear,
    statementDate: `${String(fiscalYear + 1)}-02-15`,
    reported: Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
        fieldKey,
        { status: "known", value: values[fieldKey] ?? "1" },
      ]),
    ) as PersonalAnnualFinancialReportedValuesDto,
  };
}

function financials(
  years: PersonalAnnualFinancialsDto["years"],
): PersonalAnnualFinancialsDto {
  const cells = years.flatMap(({ reported }) => Object.values(reported));
  const unknownReportedCells = cells.filter(
    ({ status }) => status === "unknown",
  ).length;
  return {
    asOf: "2030-03-01T15:00:00.000Z",
    coverage: {
      earliestFiscalYear: years.at(-1)?.fiscalYear ?? 2029,
      knownReportedCells: cells.length - unknownReportedCells,
      latestFiscalYear: years[0]?.fiscalYear ?? 2029,
      missingFiscalYears: [],
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      status: unknownReportedCells === 0 ? "complete" : "partial",
      unknownReportedCells,
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
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Synthetic Quality, Inc.",
      listingId: "lst-quality",
      securityName: "Synthetic Quality Common Stock",
      symbol: "QUAL",
    },
    status: "available",
    years,
  };
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
