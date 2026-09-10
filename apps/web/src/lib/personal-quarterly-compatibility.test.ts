import type {
  PersonalFiscalQuarterDto,
  PersonalQuarterlyFinancialsDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  type PersonalQuarterlyCompatibilityResult,
} from "@research-cockpit/personal-financial-analytics";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PersonalMarketSelection } from "../features/research/PersonalMarketOverview";
import { assessLoadedPersonalQuarterlyFinancials } from "./personal-quarterly-compatibility";
import { fetchPersonalQuarterlyFinancials } from "./personal-workspace-api";

afterEach(() => vi.unstubAllGlobals());

describe("loaded quarterly compatibility", () => {
  it("keeps sixteen fully known quarters blocked without inferring source evidence", () => {
    const result = assessed(
      assessLoadedPersonalQuarterlyFinancials(financials(), selection),
    );

    expect(result.security).toEqual({
      issuerId: "issuer-alpha",
      listingId: "lst-alpha",
    });
    expect(result.slots).toEqual([
      { fiscalYear: 2025, fiscalQuarter: 3 },
      { fiscalYear: 2025, fiscalQuarter: 4 },
      { fiscalYear: 2026, fiscalQuarter: 1 },
      { fiscalYear: 2026, fiscalQuarter: 2 },
    ]);
    for (const metric of result.metrics) {
      expect(metric.knownValues).toBe(4);
      expect(metric.status).toBe("blocked");
      expect(metric.issues.map((issue) => issue.reason)).toEqual([
        "period_evidence_missing",
        "fiscal_calendar_evidence_missing",
        "unit_evidence_missing",
        "scope_evidence_missing",
        "concept_evidence_missing",
        "source_revision_evidence_missing",
      ]);
      expect(
        metric.periods.every(
          (period) =>
            period.periodStart === null &&
            period.periodEnd === null &&
            period.sourceRef === null,
        ),
      ).toBe(true);
    }
    expect(result.ttm).toEqual({
      status: "unavailable",
      reason: "source_not_admitted",
    });
  });

  it("does not substitute older quarters or one field's known value for another's omission", () => {
    const response = financials({
      missingOffsets: [1],
      unknownRevenueOffsets: [2],
    });
    const result = assessed(
      assessLoadedPersonalQuarterlyFinancials(response, selection),
    );
    const revenue = result.metrics.find(
      (metric) => metric.metric === "revenue",
    )!;
    const income = result.metrics.find(
      (metric) => metric.metric === "net_income",
    )!;

    expect(revenue.knownValues).toBe(2);
    expect(income.knownValues).toBe(3);
    expect(revenue.periods.map((period) => period.status)).toEqual([
      "known",
      "unknown",
      "missing",
      "known",
    ]);
    expect(revenue.issues).toContainEqual({
      reason: "unknown_value",
      coordinates: [{ fiscalYear: 2025, fiscalQuarter: 4 }],
    });
    expect(
      income.issues.some((issue) => issue.reason === "unknown_value"),
    ).toBe(false);
    for (const metric of result.metrics) {
      expect(metric.issues).toContainEqual({
        reason: "missing_fiscal_slot",
        coordinates: [{ fiscalYear: 2026, fiscalQuarter: 1 }],
      });
      expect(metric.periods).toHaveLength(4);
    }
  });

  it("preserves zero, negative and large exact values without arithmetic", () => {
    const response = financials();
    const latest = response.quarters[0]!;
    const input: PersonalQuarterlyFinancialsDto = {
      ...response,
      quarters: [
        {
          ...latest,
          reported: {
            ...latest.reported,
            revenue: { status: "known", value: "0" },
            net_income: {
              status: "known",
              value: "-9007199254740993.123456789",
            },
          },
        },
        ...response.quarters.slice(1),
      ],
    };
    const result = assessed(
      assessLoadedPersonalQuarterlyFinancials(input, selection),
    );
    expect(result.metrics.map((metric) => metric.knownValues)).toEqual([4, 4]);
    expect(
      result.metrics.map((metric) => metric.periods.at(-1)?.value),
    ).toEqual(["0", "-9007199254740993.123456789"]);
    expect(result.ttm.status).toBe("unavailable");
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "withholds all assessment counts when the selected %s does not match",
    (key) => {
      const response = financials();
      const mismatched = {
        ...response,
        security: { ...response.security, [key]: "different" },
      } as PersonalQuarterlyFinancialsDto;
      expect(
        assessLoadedPersonalQuarterlyFinancials(mismatched, selection),
      ).toEqual({
        status: "quarantined",
        reason: "selection_identity_mismatch",
        ttm: { status: "unavailable", reason: "source_not_admitted" },
      });
    },
  );

  it("ignores undeclared metadata instead of treating extra properties as admitted evidence", () => {
    const response = financials();
    const embellished = {
      ...response,
      provider: { ...response.provider, revisionSetId: "allegedly-compatible" },
      quarters: response.quarters.map((quarter) => ({
        ...quarter,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        evidence: { basis: "standalone_quarter", currency: "USD" },
      })),
    };
    expect(
      assessLoadedPersonalQuarterlyFinancials(embellished, selection),
    ).toEqual(assessLoadedPersonalQuarterlyFinancials(response, selection));
  });

  it("does not mutate the source response or catalog selection", () => {
    const response = financials();
    const before = JSON.stringify(response);
    freezeDeep(response);
    freezeDeep(selection);
    const result = assessed(
      assessLoadedPersonalQuarterlyFinancials(response, selection),
    );
    expect(JSON.stringify(response)).toBe(before);
    expect(result.metrics.every((metric) => metric.knownValues === 4)).toBe(
      true,
    );
  });

  it.each([
    { options: {}, expected: [4, 4] },
    {
      options: { missingOffsets: [1], unknownRevenueOffsets: [2] },
      expected: [2, 3],
    },
  ])(
    "assesses the real validated API response without another request: $expected",
    async ({ options, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(financials(options)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const loaded = await fetchPersonalQuarterlyFinancials(
        selection,
        new AbortController().signal,
      );
      const result = assessed(
        assessLoadedPersonalQuarterlyFinancials(loaded, selection),
      );
      expect(result.metrics.map((metric) => metric.knownValues)).toEqual(
        expected,
      );
      expect(result.ttm.status).toBe("unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});

const selection: PersonalMarketSelection = {
  country: "US",
  exchangeMic: "XNAS",
  issuerId: "issuer-alpha",
  issuerName: "Synthetic Alpha Inc.",
  listingId: "lst-alpha",
  securityName: "Synthetic Alpha Common Stock",
  symbol: "ALPHA",
};

function financials(
  options: {
    missingOffsets?: readonly number[];
    unknownRevenueOffsets?: readonly number[];
  } = {},
): PersonalQuarterlyFinancialsDto {
  const coordinates = Array.from(
    { length: 16 },
    (_, offset): PersonalFiscalQuarterDto => {
      const ordinal = 2026 * 4 + 1 - offset;
      return {
        fiscalYear: Math.floor(ordinal / 4),
        fiscalQuarter: ((ordinal % 4) + 1) as 1 | 2 | 3 | 4,
      };
    },
  );
  const quarters = coordinates.flatMap((coordinate, offset) => {
    if (options.missingOffsets?.includes(offset)) return [];
    const reported = Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map((field) => [
        field.fieldKey,
        field.fieldKey === "revenue" &&
        options.unknownRevenueOffsets?.includes(offset)
          ? {
              status: "unknown",
              value: null,
              reason: "not_supplied_by_provider",
            }
          : { status: "known", value: String(100 + offset) },
      ]),
    ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"];
    return [{ ...coordinate, statementDate: "2026-08-15", reported }];
  });
  const unknown = quarters.reduce(
    (sum, quarter) =>
      sum +
      Object.values(quarter.reported).filter(
        (cell) => cell.status === "unknown",
      ).length,
    0,
  );
  const latest = quarters[0]!;
  const earliest = quarters.at(-1)!;
  return {
    asOf: "2026-09-10T00:00:00.000Z",
    profile: "personal_single_user_local_fundamentals",
    schemaVersion: "1.0.0",
    status: "available",
    security: {
      country: selection.country,
      exchangeMic: selection.exchangeMic,
      issuerName: selection.issuerName,
      listingId: selection.listingId,
      securityName: selection.securityName,
      symbol: selection.symbol,
    },
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
    coverage: {
      earliestFiscalQuarter: earliest.fiscalQuarter,
      earliestFiscalYear: earliest.fiscalYear,
      latestFiscalQuarter: latest.fiscalQuarter,
      latestFiscalYear: latest.fiscalYear,
      knownReportedCells: quarters.length * 30 - unknown,
      unknownReportedCells: unknown,
      missingFiscalQuarters: coordinates
        .filter((_, offset) => options.missingOffsets?.includes(offset))
        .map(({ fiscalYear, fiscalQuarter }) => ({
          fiscalQuarter,
          fiscalYear,
        })),
      requestedQuarterlyPeriods: 16,
      returnedQuarterlyPeriods: quarters.length,
      status: quarters.length === 16 && unknown === 0 ? "complete" : "partial",
    },
    quarters,
  };
}

function assessed(result: PersonalQuarterlyCompatibilityResult) {
  expect(result.status).toBe("assessed");
  if (result.status !== "assessed") throw new Error(result.reason);
  return result;
}

function freezeDeep(value: object): void {
  Object.freeze(value);
  for (const child of Object.values(value) as unknown[]) {
    if (typeof child === "object" && child !== null) freezeDeep(child);
  }
}
