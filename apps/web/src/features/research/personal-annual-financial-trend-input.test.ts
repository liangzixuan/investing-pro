import type {
  PersonalAnnualFinancialReportedCellDto,
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import {
  buildPersonalFinancialAnalytics,
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
} from "@research-cockpit/personal-financial-analytics";
import { describe, expect, it } from "vitest";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import {
  PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS,
  projectPersonalAnnualFinancialTrend,
  type PersonalAnnualFinancialTrendField,
} from "./personal-annual-financial-trend-input";

describe("projectPersonalAnnualFinancialTrend", () => {
  it("aligns ten oldest-first fiscal years while retaining missing, unknown, zero and each own date", () => {
    const source = financials([
      {
        ...year(2029, {
          revenue: "0",
          net_income: "-12.345",
          free_cash_flow: "-7",
        }),
        statementDate: "2031-04-19",
      },
      year(2027, { revenue: unknown(), operating_cash_flow: "0.000001" }),
      { ...year(2020, { revenue: "1.23456789" }), statementDate: "2022-02-28" },
    ]);
    const result = ready(source);

    expect(result.slots.map((slot) => slot.fiscalYear)).toEqual([
      2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029,
    ]);
    expect(result.slots[1]).toEqual({
      status: "missing_year",
      fiscalYear: 2021,
      statementDate: null,
      cells: null,
    });
    expect(result.slots[7]).toMatchObject({
      status: "reported",
      fiscalYear: 2027,
      statementDate: "2028-02-15",
      cells: { revenue: unknown(), operating_cash_flow: known("0.000001") },
    });
    expect(result.slots[9]).toMatchObject({
      statementDate: "2031-04-19",
      cells: {
        revenue: known("0"),
        net_income: known("-12.345"),
        free_cash_flow: known("-7"),
      },
    });
    expect(result.slots[0]?.statementDate).toBe("2022-02-28");
    expect(result.plots.revenue).toEqual({
      status: "ready",
      values: [1.23456789, null, null, null, null, null, null, null, null, 0],
    });
    expect(result.asOf).toBe("2030-01-16T15:00:00.000Z");
    expect(result.unit).toBe("USD");
    expect(Object.keys(result.slots[9]?.cells ?? {})).toEqual(
      PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS,
    );
  });

  it("uses provider-reported free cash flow exactly, independently of cash flow and capex", () => {
    const result = ready(
      financials([
        year(2029, {
          free_cash_flow: "-3.125",
          operating_cash_flow: "500",
          capital_expenditures: "40",
        }),
      ]),
    );
    expect(result.plots.free_cash_flow).toEqual({
      status: "ready",
      values: [...Array<null>(9).fill(null), -3.125],
    });
    expect(result.slots[9]?.cells?.free_cash_flow).toEqual(known("-3.125"));
  });

  it("admits partial coverage with an unknown outside the four consumed fields", () => {
    const source = financials(
      Array.from({ length: 10 }, (_, index) =>
        year(2029 - index, { gross_profit: unknown() }),
      ),
    );
    expect(source.coverage.status).toBe("partial");
    expect(source.coverage.unknownReportedCells).toBe(10);
    const result = ready(source);
    expect(result.slots.every((slot) => slot.status === "reported")).toBe(true);
    for (const field of PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS) {
      expect(result.plots[field]).toEqual({
        status: "ready",
        values: Array<number>(10).fill(1),
      });
    }
  });

  it("honors the existing real engine quarantine without filtering it into a ready trend", () => {
    const period = {
      fiscalYear: 2029,
      statementDate: "2030-02-15",
      facts: [],
    };
    const analytics = buildPersonalFinancialAnalytics({
      asOf: "2030-01-16T15:00:00.000Z",
      periods: [period, period],
    });
    expect(analytics.status).toBe("quarantined");
    const result = projectPersonalAnnualFinancialTrend({
      financials: financials(),
      selection: selection(),
      analyticsStatus: analytics.status,
    });
    expect(result).toEqual({ status: "unavailable", reason: "quarantined" });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("distinguishes all-unknown, one known zero and a fully zero series", () => {
    const allUnknown = financials([
      year(2029, {
        revenue: unknown(),
        net_income: unknown(),
        operating_cash_flow: unknown(),
        free_cash_flow: unknown(),
      }),
    ]);
    const unknownResult = ready(allUnknown);
    for (const field of PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS) {
      expect(unknownResult.plots[field]).toEqual({
        status: "unavailable",
        reason: "no_known_values",
      });
    }
    expect(
      ready(withCell(allUnknown, "revenue", known("0"))).plots.revenue,
    ).toEqual({
      status: "ready",
      values: [...Array<null>(9).fill(null), 0],
    });
    const zeros = ready(
      financials(
        Array.from({ length: 10 }, (_, index) =>
          year(2029 - index, { revenue: "0" }),
        ),
      ),
    );
    expect(zeros.plots.revenue).toEqual({
      status: "ready",
      values: Array<number>(10).fill(0),
    });
  });

  it.each([
    "0",
    "-1",
    "1.25",
    "-0.0001",
    "9007199254740991",
    "-9007199254740991",
    "9007199254740990.9",
    "-9007199254740990.9",
    `0.${"0".repeat(61)}1`,
    `-0.${"0".repeat(60)}1`,
  ])(
    "preserves exact admitted %s while safely projecting its signed coordinate",
    (value) => {
      const result = ready(withCell(financials(), "revenue", known(value)));
      expect(result.slots[9]?.cells?.revenue).toEqual(known(value));
      expect(result.plots.revenue).toEqual({
        status: "ready",
        values: [...Array<null>(9).fill(null), Number(value)],
      });
      if (value !== "0") expect(Number(value)).not.toBe(0);
    },
  );

  it.each([
    "9007199254740991.1",
    "-9007199254740991.1",
    "9007199254740992",
    "-9007199254740992",
    "9".repeat(64),
  ])(
    "withholds the entire metric for unsafe %s but preserves its exact table and other metrics",
    (value) => {
      const result = ready(
        financials([
          year(2029, { revenue: "12" }),
          year(2028, { revenue: value }),
        ]),
      );
      expect(result.slots[8]?.cells?.revenue).toEqual(known(value));
      expect(result.slots[9]?.cells?.revenue).toEqual(known("12"));
      expect(result.plots.revenue).toEqual({
        status: "unavailable",
        reason: "unsafe_plot_value",
      });
      expect(result.plots.net_income).toEqual({
        status: "ready",
        values: [...Array<null>(8).fill(null), 1, 1],
      });
    },
  );

  it("rejects fractional excess before Number can round it back to the safe integer", () => {
    const value = "9007199254740991.0000000000000000000000001";
    expect(Number(value)).toBe(Number.MAX_SAFE_INTEGER);
    for (const signed of [value, `-${value}`]) {
      expect(
        ready(withCell(financials(), "revenue", known(signed))).plots.revenue,
      ).toEqual({ status: "unavailable", reason: "unsafe_plot_value" });
    }
  });

  it.each([
    "-0",
    "0.0",
    "12.340",
    "01",
    "+1",
    "1e3",
    " 1",
    "1 ",
    ".5",
    "1.",
    "",
    "1".repeat(65),
  ])(
    "rejects noncanonical financial lexeme %j without normalization",
    (value) => {
      expectInvalid(withCell(financials(), "net_income", known(value)));
    },
  );

  it.each([
    { status: "known", value: 1 },
    { status: "known", value: "1", reason: "not_supplied_by_provider" },
    { status: "unknown", value: "0", reason: "not_supplied_by_provider" },
    { status: "unknown", value: null, reason: "other" },
    { status: "unknown", value: null },
  ])("rejects a malformed consumed cell %j", (cell) => {
    expectInvalid(withCell(financials(), "operating_cash_flow", cell));
  });

  it("checks every consumed metric and returned period instead of accepting a valid latest metric only", () => {
    for (const field of PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS) {
      const source = financials([year(2029), year(2028, { [field]: "1.0" })]);
      expectInvalid(source);
    }
  });

  it.each([
    ["empty years", () => ({ ...financials(), years: [] })],
    [
      "too many years",
      () =>
        financials(
          Array.from({ length: 11 }, (_, index) => year(2029 - index)),
        ),
    ],
    ["duplicate year", () => financials([year(2029), year(2029)])],
    ["ascending year", () => financials([year(2028), year(2029)])],
    ["fractional year", () => financials([year(2029.5)])],
    ["out of window", () => financials([year(2029), year(2019)])],
    ["unbounded window", () => financials([year(1908)])],
    ["unbounded latest", () => financials([year(10000)])],
    ["wrong latest", () => withCoverage({ latestFiscalYear: 2030 })],
    ["wrong earliest", () => withCoverage({ earliestFiscalYear: 2028 })],
    ["wrong returned count", () => withCoverage({ returnedAnnualYears: 2 })],
    [
      "wrong requested window",
      () => withCoverage({ requestedAnnualYears: 9 as 10 }),
    ],
    [
      "wrong missing order",
      () =>
        withCoverage({
          missingFiscalYears: [
            ...financials().coverage.missingFiscalYears,
          ].reverse(),
        }),
    ],
    [
      "extra missing year",
      () =>
        withCoverage({
          missingFiscalYears: [
            ...financials().coverage.missingFiscalYears,
            2029,
          ],
        }),
    ],
    [
      "omitted missing year",
      () =>
        withCoverage({
          missingFiscalYears: financials().coverage.missingFiscalYears.slice(1),
        }),
    ],
  ] as const)(
    "rejects inconsistent consumed coverage: %s",
    (_label, makeSource) => {
      expectInvalid(makeSource());
    },
  );

  it.each([
    "2029-02-29",
    "2030-13-01",
    "2030-2-01",
    "2030-01-01T00:00:00.000Z",
  ])("rejects invalid or non-date statement coordinate %s", (statementDate) => {
    expectInvalid(financials([{ ...year(2029), statementDate }]));
  });

  it.each([
    "2030-02-29T00:00:00.000Z",
    "2030-01-16T15:00:00Z",
    "2030-01-16T15:00:00.000+00:00",
  ])("rejects invalid or noncanonical response instant %s", (asOf) =>
    expectInvalid({ ...financials(), asOf }),
  );

  it("admits a valid leap date and rejects a non-USD label", () => {
    expect(
      ready(financials([{ ...year(2029), statementDate: "2028-02-29" }]))
        .slots[9]?.statementDate,
    ).toBe("2028-02-29");
    const source = financials();
    expectInvalid({
      ...source,
      provider: { ...source.provider, valueCurrency: "EUR" as "USD" },
    });
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "XNYS"],
    ["issuerName", "Changed issuer"],
    ["listingId", "lst-other"],
    ["securityName", "Changed security"],
    ["symbol", "OTHER"],
  ] as const)("requires exact source association for %s", (field, value) => {
    const selected = {
      ...selection(),
      [field]: value,
    } as PersonalMarketSelection;
    expect(
      projectPersonalAnnualFinancialTrend({
        financials: financials(),
        selection: selected,
        analyticsStatus: "ready",
      }),
    ).toEqual({ status: "unavailable", reason: "identity_mismatch" });
  });

  it("uses all seven admitted selection fields for lifetime without pretending issuerId is source-verified", () => {
    const original = ready(financials());
    for (const field of [
      "country",
      "exchangeMic",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
    ] as const) {
      if (field === "country") continue; // US is the only admitted selection country.
      const selected = {
        ...selection(),
        [field]: `${selection()[field]} changed`,
      };
      const source = {
        ...financials(),
        security: { ...financials().security, [field]: selected[field] },
      };
      const result = ready(source, selected);
      expect(result.selectionKey).not.toBe(original.selectionKey);
      expect(result.contentKey).not.toBe(original.contentKey);
    }
    const issuerReplacement = ready(financials(), {
      ...selection(),
      issuerId: "issuer-replacement",
    });
    expect(issuerReplacement.selectionKey).not.toBe(original.selectionKey);
    expect(issuerReplacement.contentKey).not.toBe(original.contentKey);
    expect(issuerReplacement.plots).toEqual(original.plots);
    expect(JSON.parse(original.selectionKey)).toEqual([
      "US",
      "XNAS",
      "issuer-zero",
      "Zero Alpha, Inc.",
      "lst-zero",
      "Zero Alpha Common Stock",
      "ZERO",
    ]);
  });

  it("keeps equal consumed content stable across clones and changes keys only for displayed source replacements", () => {
    const source = financials();
    const original = ready(source);
    expect(ready(structuredClone(source), { ...selection() }).contentKey).toBe(
      original.contentKey,
    );
    const unrelated = financials([
      year(2029, { gross_profit: unknown(), capital_expenditures: "-999" }),
    ]);
    expect(ready(unrelated).contentKey).toBe(original.contentKey);
    for (const replacement of [
      { ...source, asOf: "2030-01-17T15:00:00.000Z" },
      financials([{ ...year(2029), statementDate: "2030-03-01" }]),
      financials([year(2029), year(2028)]),
      ...PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.map((field) =>
        withCell(source, field, known("-2.75")),
      ),
      withCell(source, "revenue", unknown()),
    ]) {
      const result = ready(replacement);
      expect(result.contentKey).not.toBe(original.contentKey);
      expect(result.selectionKey).toBe(original.selectionKey);
    }
  });

  it("copies and freezes every consumed output without freezing, mutating or retaining source objects", () => {
    const source = financials([year(2029, { revenue: unknown() }), year(2028)]);
    const selected = selection();
    const before = structuredClone(source);
    const result = ready(source, selected);
    expect(source).toEqual(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(selected)).toBe(false);
    expect(result.identity).not.toBe(selected);
    expect(result.slots).not.toBe(source.years);
    expect(result.slots[9]?.cells?.revenue).not.toBe(
      source.years[0]?.reported.revenue,
    );
    expectDeepFrozen(result);
    Object.defineProperty(source.years[0]?.reported, "revenue", {
      value: known("999"),
    });
    Object.defineProperty(selected, "issuerName", {
      value: "Later replacement",
    });
    expect(result.slots[9]?.cells?.revenue).toEqual(unknown());
    expect(result.identity.issuerName).toBe("Zero Alpha, Inc.");
    expect(Reflect.set(result.identity, "symbol", "OTHER")).toBe(false);
    expect(Reflect.set(result.slots, "0", null)).toBe(false);
  });
});

function ready(source: PersonalAnnualFinancialsDto, selected = selection()) {
  const result = projectPersonalAnnualFinancialTrend({
    financials: source,
    selection: selected,
    analyticsStatus: "ready",
  });
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error(`Unexpected ${result.reason}`);
  return result;
}

function expectInvalid(source: PersonalAnnualFinancialsDto) {
  expect(
    projectPersonalAnnualFinancialTrend({
      financials: source,
      selection: selection(),
      analyticsStatus: "ready",
    }),
  ).toEqual({ status: "unavailable", reason: "invalid_input" });
}

function withCoverage(
  coverage: Partial<PersonalAnnualFinancialsDto["coverage"]>,
) {
  const source = financials();
  return { ...source, coverage: { ...source.coverage, ...coverage } };
}

function withCell(
  source: PersonalAnnualFinancialsDto,
  field: PersonalAnnualFinancialTrendField,
  cell: unknown,
): PersonalAnnualFinancialsDto {
  return {
    ...source,
    years: source.years.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            reported: {
              ...entry.reported,
              [field]: cell,
            },
          }
        : entry,
    ),
  };
}

function financials(
  years: PersonalAnnualFinancialsDto["years"] = [year(2029)],
): PersonalAnnualFinancialsDto {
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined)
    throw new Error("Fixture requires a returned year");
  const missingFiscalYears = Array.from(
    { length: 10 },
    (_, index) => first.fiscalYear - index,
  ).filter(
    (fiscalYear) => !years.some((entry) => entry.fiscalYear === fiscalYear),
  );
  const cells = years.flatMap((entry) => Object.values(entry.reported));
  const unknownReportedCells = cells.filter(
    (cell) => cell.status === "unknown",
  ).length;
  return {
    asOf: "2030-01-16T15:00:00.000Z",
    coverage: {
      earliestFiscalYear: last.fiscalYear,
      latestFiscalYear: first.fiscalYear,
      knownReportedCells: cells.length - unknownReportedCells,
      missingFiscalYears,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      status:
        missingFiscalYears.length === 0 && unknownReportedCells === 0
          ? "complete"
          : "partial",
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
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    status: "available",
    years,
  };
}

function year(
  fiscalYear: number,
  values: Partial<
    Record<
      PersonalAnnualFinancialReportedFieldKeyDto,
      string | PersonalAnnualFinancialReportedCellDto
    >
  > = {},
): PersonalAnnualFinancialsDto["years"][number] {
  const reported = Object.fromEntries(
    PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => {
      const value = values[fieldKey] ?? "1";
      return [fieldKey, typeof value === "string" ? known(value) : value];
    }),
  ) as PersonalAnnualFinancialReportedValuesDto;
  return {
    fiscalYear,
    reported,
    statementDate: `${String(fiscalYear + 1)}-02-15`,
  };
}

function known(value: string): PersonalAnnualFinancialReportedCellDto {
  return { status: "known", value };
}

function unknown(): PersonalAnnualFinancialReportedCellDto {
  return { status: "unknown", value: null, reason: "not_supplied_by_provider" };
}

function selection(): PersonalMarketSelection {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: "issuer-zero",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}

function expectDeepFrozen(value: unknown) {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeepFrozen(child);
  }
}
