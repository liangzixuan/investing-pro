import { describe, expect, it } from "vitest";

import {
  assessPersonalQuarterlyCompatibility,
  type PersonalQuarterlyCompatibilityEvidence,
  type PersonalQuarterlyCompatibilityInput,
  type PersonalQuarterlyCompatibilityMetricKey,
  type PersonalQuarterlyCompatibilityQuarterInput,
} from "./personal-quarterly-compatibility";

function date(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function evidence(
  fiscalYear: number,
  fiscalQuarter: 1 | 2 | 3 | 4,
  metric: PersonalQuarterlyCompatibilityMetricKey,
  startMonth = 0,
): PersonalQuarterlyCompatibilityEvidence {
  const year = fiscalYear - (startMonth === 0 ? 0 : 1);
  return {
    period: {
      startDate: date(year, startMonth + (fiscalQuarter - 1) * 3, 1),
      endDate: date(year, startMonth + fiscalQuarter * 3, 0),
      basis: "standalone_quarter",
    },
    fiscalCalendar: {
      id: "declared-fiscal-calendar",
      kind: "calendar_months",
      fiscalYearStart: date(year, startMonth, 1),
    },
    unit: { currency: "USD", unit: "USD", scalePower10: 0 },
    scope: {
      issuerId: "issuer-a",
      consolidation: "consolidated",
      dimensions: [],
    },
    concept: {
      taxonomy: "us-gaap-2025",
      code: metric === "revenue" ? "Revenues" : "NetIncomeLoss",
      signConvention: "reported_signed",
    },
    source: {
      id: "synthetic-not-an-admitted-source",
      reference: `fixture-${String(fiscalYear)}-${String(fiscalQuarter)}-${metric}`,
      revisionId: `version-${String(fiscalYear)}-${String(fiscalQuarter)}`,
      revisionSetId: "declared-current-set",
    },
  };
}

function quarter(
  fiscalYear: number,
  fiscalQuarter: 1 | 2 | 3 | 4,
  startMonth = 0,
): PersonalQuarterlyCompatibilityQuarterInput {
  return {
    fiscalYear,
    fiscalQuarter,
    statementDate: "2026-05-01",
    reported: {
      revenue: {
        value: "100.123",
        evidence: evidence(fiscalYear, fiscalQuarter, "revenue", startMonth),
      },
      net_income: {
        value: "-5.4500",
        evidence: evidence(fiscalYear, fiscalQuarter, "net_income", startMonth),
      },
    },
  };
}

function input(startMonth = 0): PersonalQuarterlyCompatibilityInput {
  return {
    security: { issuerId: "issuer-a", listingId: "listing-a" },
    anchor: { fiscalYear: 2026, fiscalQuarter: 1 },
    quarters: [
      quarter(2025, 2, startMonth),
      quarter(2025, 3, startMonth),
      quarter(2025, 4, startMonth),
      quarter(2026, 1, startMonth),
    ],
  };
}

function changeEvidence(
  value: PersonalQuarterlyCompatibilityInput,
  transform: (
    evidence: PersonalQuarterlyCompatibilityEvidence,
  ) => PersonalQuarterlyCompatibilityEvidence | null,
  metric: PersonalQuarterlyCompatibilityMetricKey = "revenue",
  index = 1,
): PersonalQuarterlyCompatibilityInput {
  return {
    ...value,
    quarters: value.quarters.map((period, candidate) =>
      candidate !== index
        ? period
        : {
            ...period,
            reported: {
              ...period.reported,
              [metric]: {
                ...period.reported[metric],
                evidence: transform(period.reported[metric].evidence!),
              },
            },
          },
    ),
  };
}

function assessed(value = input()) {
  const result = assessPersonalQuarterlyCompatibility(value);
  expect(result.status).toBe("assessed");
  if (result.status !== "assessed") throw Error(result.reason);
  return result;
}

function revenue(value: PersonalQuarterlyCompatibilityInput) {
  const result = assessed(value);
  expect(result.metrics[0]?.metric).toBe("revenue");
  return result.metrics[0]!;
}

function reasons(value: PersonalQuarterlyCompatibilityInput) {
  return revenue(value).issues.map((issue) => issue.reason);
}

function expectQuarantine(value: unknown, reason = "invalid_input") {
  expect(
    assessPersonalQuarterlyCompatibility(
      value as PersonalQuarterlyCompatibilityInput,
    ),
  ).toEqual({
    status: "quarantined",
    reason,
    ttm: { status: "unavailable", reason: "source_not_admitted" },
  });
}

describe("offline quarterly compatibility", () => {
  it("assesses the four expected slots without calculating or admitting TTM", () => {
    const result = assessed();
    expect(result.slots).toEqual([
      { fiscalYear: 2025, fiscalQuarter: 2 },
      { fiscalYear: 2025, fiscalQuarter: 3 },
      { fiscalYear: 2025, fiscalQuarter: 4 },
      { fiscalYear: 2026, fiscalQuarter: 1 },
    ]);
    expect(
      result.metrics.map(({ metric, status, knownValues, issues }) => ({
        metric,
        status,
        knownValues,
        issues,
      })),
    ).toEqual([
      {
        metric: "revenue",
        status: "compatible_inputs",
        knownValues: 4,
        issues: [],
      },
      {
        metric: "net_income",
        status: "compatible_inputs",
        knownValues: 4,
        issues: [],
      },
    ]);
    expect(result.metrics[0]?.periods[0]).toEqual({
      fiscalYear: 2025,
      fiscalQuarter: 2,
      status: "known",
      value: "100.123",
      statementDate: "2026-05-01",
      periodStart: "2025-04-01",
      periodEnd: "2025-06-30",
      sourceRef: "fixture-2025-2-revenue",
    });
    expect(result.metrics[1]?.periods[0]?.value).toBe("-5.4500");
    expect(result.ttm).toEqual({
      status: "unavailable",
      reason: "source_not_admitted",
    });
    expect(Object.keys(result.metrics[0]!)).toEqual([
      "metric",
      "status",
      "knownValues",
      "periods",
      "issues",
    ]);
    expect(Object.keys(result.ttm)).toEqual(["status", "reason"]);
  });

  it("uses coordinates independently of input order", () => {
    const value = input();
    expect(
      assessed({ ...value, quarters: [...value.quarters].reverse() }),
    ).toEqual(assessed(value));
  });

  it("never replaces a missing selected quarter with an older known quarter", () => {
    const value = input();
    const result = assessed({
      ...value,
      quarters: [
        quarter(2025, 1),
        ...value.quarters.filter((_, index) => index !== 1),
      ],
    });
    expect(result.metrics[0]?.knownValues).toBe(3);
    expect(result.metrics[0]?.periods[1]).toEqual({
      fiscalYear: 2025,
      fiscalQuarter: 3,
      status: "missing",
      value: null,
      statementDate: null,
      periodStart: null,
      periodEnd: null,
      sourceRef: null,
    });
    expect(result.metrics[0]?.issues).toEqual([
      {
        reason: "missing_fiscal_slot",
        coordinates: [{ fiscalYear: 2025, fiscalQuarter: 3 }],
      },
    ]);
  });

  it("distinguishes an unknown cell from an absent slot and preserves the other metric", () => {
    const value = input();
    const result = assessed({
      ...value,
      quarters: value.quarters.map((period, index) =>
        index !== 1
          ? period
          : {
              ...period,
              reported: {
                ...period.reported,
                revenue: { ...period.reported.revenue, value: null },
              },
            },
      ),
    });
    expect(result.metrics[0]?.knownValues).toBe(3);
    expect(result.metrics[0]?.periods[1]?.status).toBe("unknown");
    expect(result.metrics[0]?.issues).toEqual([
      {
        reason: "unknown_value",
        coordinates: [{ fiscalYear: 2025, fiscalQuarter: 3 }],
      },
    ]);
    expect(result.metrics[1]?.status).toBe("compatible_inputs");
  });

  it("keeps all six evidence groups missing despite known values and statement dates", () => {
    const value = input();
    const result = assessed({
      ...value,
      quarters: value.quarters.map((period) => ({
        ...period,
        reported: {
          revenue: { value: "123", evidence: null },
          net_income: { value: "12", evidence: null },
        },
      })),
    });
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
        metric.issues.every(
          (issue) =>
            JSON.stringify(issue.coordinates) === JSON.stringify(result.slots),
        ),
      ).toBe(true);
      expect(
        metric.periods.every(
          (period) =>
            period.periodStart === null &&
            period.periodEnd === null &&
            period.sourceRef === null,
        ),
      ).toBe(true);
    }
  });

  it("assesses an empty source as four absent slots", () => {
    const result = assessed({ ...input(), quarters: [] });
    expect(
      result.metrics.every(
        (metric) =>
          metric.knownValues === 0 &&
          metric.issues.length === 1 &&
          metric.issues[0]?.reason === "missing_fiscal_slot",
      ),
    ).toBe(true);
    expect(result.metrics[0]?.issues[0]?.coordinates).toEqual(result.slots);
  });

  it.each([3, 6, 9])(
    "supports an explicit month-based fiscal year beginning in month offset %i",
    (startMonth) => {
      const result = assessed(input(startMonth));
      expect(
        result.metrics.every((metric) => metric.status === "compatible_inputs"),
      ).toBe(true);
      expect(result.metrics[0]?.periods[3]?.periodStart).toBe(
        date(2025, startMonth, 1),
      );
    },
  );

  it("checks calendar months across leap years without a day-count tolerance", () => {
    const value: PersonalQuarterlyCompatibilityInput = {
      ...input(),
      anchor: { fiscalYear: 2024, fiscalQuarter: 4 },
      quarters: [
        quarter(2024, 1),
        quarter(2024, 2),
        quarter(2024, 3),
        quarter(2024, 4),
      ],
    };
    expect(revenue(value).status).toBe("compatible_inputs");
    expect(revenue(value).periods[0]).toMatchObject({
      periodStart: "2024-01-01",
      periodEnd: "2024-03-31",
    });
  });

  it("supports a non-January fiscal calendar labeled by its starting year", () => {
    const value = input(9);
    const shifted = {
      ...value,
      quarters: value.quarters.map((period) => ({
        ...period,
        reported: {
          revenue: {
            ...period.reported.revenue,
            evidence: evidence(
              period.fiscalYear + 1,
              period.fiscalQuarter,
              "revenue",
              9,
            ),
          },
          net_income: {
            ...period.reported.net_income,
            evidence: evidence(
              period.fiscalYear + 1,
              period.fiscalQuarter,
              "net_income",
              9,
            ),
          },
        },
      })),
    };
    const result = assessed(shifted);
    expect(
      result.metrics.every((metric) => metric.status === "compatible_inputs"),
    ).toBe(true);
    expect(result.metrics[0]?.periods[3]?.periodStart).toBe("2026-10-01");
  });

  it.each([-35, 1])(
    "blocks coherent fiscal dates shifted %i years outside the supported label convention",
    (years) => {
      const value = input();
      const result = revenue({
        ...value,
        quarters: value.quarters.map((period) => ({
          ...period,
          reported: {
            ...period.reported,
            revenue: {
              ...period.reported.revenue,
              evidence: evidence(
                period.fiscalYear + years,
                period.fiscalQuarter,
                "revenue",
              ),
            },
          },
        })),
      });
      expect(result.issues).toEqual([
        {
          reason: "period_calendar_mismatch",
          coordinates: assessed(value).slots,
        },
      ]);
      expect(result.status).toBe("blocked");
    },
  );

  it.each(["year_to_date", "annual", "instant"] as const)(
    "blocks %s flow basis without deriving quarters",
    (basis) => {
      const value = changeEvidence(input(), (prior) => ({
        ...prior,
        period: { ...prior.period!, basis },
      }));
      expect(reasons(value)).toContain("unsupported_period_basis");
      expect(revenue(value).periods[1]?.value).toBe("100.123");
    },
  );

  it("does not derive Q4 from annual minus nine-month YTD", () => {
    const ytd = changeEvidence(input(), (prior) => ({
      ...prior,
      period: {
        ...prior.period!,
        startDate: "2025-01-01",
        basis: "year_to_date",
      },
    }));
    const annual = changeEvidence(
      ytd,
      (prior) => ({
        ...prior,
        period: { ...prior.period!, startDate: "2025-01-01", basis: "annual" },
      }),
      "revenue",
      2,
    );
    expect(revenue(annual).issues).toContainEqual({
      reason: "unsupported_period_basis",
      coordinates: [
        { fiscalYear: 2025, fiscalQuarter: 3 },
        { fiscalYear: 2025, fiscalQuarter: 4 },
      ],
    });
    expect(reasons(annual)).toContain("noncontiguous_periods");
    expect(revenue(annual).periods[2]?.value).toBe("100.123");
  });

  it.each(["week_based", "transition"] as const)(
    "blocks the declared %s fiscal policy",
    (kind) => {
      const value = input();
      const result = revenue({
        ...value,
        quarters: value.quarters.map((period) => ({
          ...period,
          reported: {
            ...period.reported,
            revenue: {
              ...period.reported.revenue,
              evidence: {
                ...period.reported.revenue.evidence!,
                fiscalCalendar: {
                  ...period.reported.revenue.evidence!.fiscalCalendar!,
                  kind,
                },
              },
            },
          },
        })),
      });
      expect(result.status).toBe("blocked");
      expect(result.issues[0]?.reason).toBe("unsupported_fiscal_calendar");
      expect(result.issues[0]?.coordinates).toHaveLength(4);
    },
  );

  it("does not treat a 53-week year as a verified twelve-month span", () => {
    const base: PersonalQuarterlyCompatibilityInput = {
      ...input(),
      anchor: { fiscalYear: 2025, fiscalQuarter: 4 },
      quarters: [
        quarter(2025, 1),
        quarter(2025, 2),
        quarter(2025, 3),
        quarter(2025, 4),
      ],
    };
    const ends = ["2025-04-05", "2025-07-05", "2025-10-04", "2026-01-03"];
    const starts = ["2024-12-29", "2025-04-06", "2025-07-06", "2025-10-05"];
    const value = {
      ...base,
      quarters: base.quarters.map((period, index) => ({
        ...period,
        reported: {
          ...period.reported,
          revenue: {
            ...period.reported.revenue,
            evidence: {
              ...period.reported.revenue.evidence!,
              fiscalCalendar: {
                id: "53-week-declaration",
                kind: "week_based" as const,
                fiscalYearStart: "2024-12-29",
              },
              period: {
                basis: "standalone_quarter" as const,
                startDate: starts[index]!,
                endDate: ends[index]!,
              },
            },
          },
        },
      })),
    };
    expect(reasons(value)).toEqual(["unsupported_fiscal_calendar"]);
    expect(assessed(value).ttm.status).toBe("unavailable");
  });

  it.each(["2025-07-02", "2025-06-30"])(
    "rejects a one-day gap or overlap beginning %s",
    (startDate) => {
      const value = changeEvidence(input(), (prior) => ({
        ...prior,
        period: { ...prior.period!, startDate },
      }));
      expect(reasons(value)).toEqual([
        "period_calendar_mismatch",
        "noncontiguous_periods",
      ]);
    },
  );

  it("rejects a short period even when fiscal labels remain consecutive", () => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      period: { ...prior.period!, endDate: "2025-09-29" },
    }));
    expect(reasons(value)).toContain("period_calendar_mismatch");
  });

  it("requires the fiscal-year start to be the first day of a month", () => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      fiscalCalendar: {
        ...prior.fiscalCalendar!,
        fiscalYearStart: "2025-01-02",
      },
    }));
    expect(reasons(value)).toContain("period_calendar_mismatch");
  });

  it("rejects a changed calendar ID despite contiguous actual dates", () => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      fiscalCalendar: { ...prior.fiscalCalendar!, id: "changed-policy" },
    }));
    expect(reasons(value)).toEqual(["fiscal_calendar_mismatch"]);
  });

  it("requires coherent fiscal starts at the year rollover", () => {
    const value = changeEvidence(
      input(),
      (prior) => ({
        ...prior,
        fiscalCalendar: {
          ...prior.fiscalCalendar!,
          fiscalYearStart: "2026-02-01",
        },
        period: {
          ...prior.period!,
          startDate: "2026-02-01",
          endDate: "2026-04-30",
        },
      }),
      "revenue",
      3,
    );
    expect(reasons(value)).toEqual([
      "fiscal_calendar_mismatch",
      "noncontiguous_periods",
    ]);
  });

  it.each([
    { currency: "EUR", unit: "USD", scalePower10: 0 },
    { currency: "USD", unit: "shares", scalePower10: 0 },
    { currency: "USD", unit: "USD", scalePower10: 3 },
  ])("rejects unsupported unit declaration %j without conversion", (unit) => {
    expect(
      reasons(changeEvidence(input(), (prior) => ({ ...prior, unit }))),
    ).toEqual(["unsupported_unit"]);
  });

  it.each([
    [
      {
        issuerId: "other-issuer",
        consolidation: "consolidated",
        dimensions: [],
      },
      "issuer_mismatch",
    ],
    [
      { issuerId: "issuer-a", consolidation: "other", dimensions: [] },
      "unsupported_scope",
    ],
    [
      {
        issuerId: "issuer-a",
        consolidation: "consolidated",
        dimensions: ["segment=retail"],
      },
      "unsupported_scope",
    ],
  ] as const)("rejects incompatible reporting scope %j", (scope, reason) => {
    expect(
      reasons(changeEvidence(input(), (prior) => ({ ...prior, scope }))),
    ).toEqual([reason]);
  });

  it.each([
    {
      taxonomy: "us-gaap-2026",
      code: "Revenues",
      signConvention: "reported_signed" as const,
    },
    {
      taxonomy: "us-gaap-2025",
      code: "SalesRevenueNet",
      signConvention: "reported_signed" as const,
    },
  ])("requires the same declared taxonomy and concept %j", (concept) => {
    expect(
      reasons(changeEvidence(input(), (prior) => ({ ...prior, concept }))),
    ).toEqual(["concept_mismatch"]);
  });

  it("does not silently flip a differing sign convention", () => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      concept: { ...prior.concept!, signConvention: "other" },
    }));
    expect(reasons(value)).toEqual([
      "unsupported_sign_convention",
      "concept_mismatch",
    ]);
  });

  it("rejects mixed source and revision-set declarations independently", () => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      source: {
        ...prior.source!,
        id: "another-provider",
        revisionSetId: "original-history",
      },
    }));
    expect(reasons(value)).toEqual(["mixed_sources", "revision_set_mismatch"]);
  });

  it("permits distinct filing/revision references within one declared coherent set", () => {
    const result = assessed();
    expect(
      new Set(result.metrics[0]?.periods.map((period) => period.sourceRef))
        .size,
    ).toBe(4);
    expect(result.metrics[0]?.status).toBe("compatible_inputs");
    expect(result.ttm.reason).toBe("source_not_admitted");
  });

  it("does not treat matching arbitrary source/revision labels as source admission", () => {
    const value = input();
    const result = assessed({
      ...value,
      quarters: value.quarters.map((period) => ({
        ...period,
        reported: {
          ...period.reported,
          revenue: {
            ...period.reported.revenue,
            evidence: {
              ...period.reported.revenue.evidence!,
              source: {
                id: "merely-a-declaration",
                reference: "not-verified",
                revisionId: "arbitrary",
                revisionSetId: "arbitrary",
              },
            },
          },
        },
      })),
    });
    expect(result.metrics[0]?.status).toBe("compatible_inputs");
    expect(result.ttm).toEqual({
      status: "unavailable",
      reason: "source_not_admitted",
    });
  });

  it("preserves independent incompatibilities even when another slot lacks evidence", () => {
    const missing = changeEvidence(input(), () => null);
    const mismatched = changeEvidence(
      missing,
      (prior) => ({
        ...prior,
        unit: { currency: "EUR", unit: "EUR", scalePower10: 0 },
        source: { ...prior.source!, revisionSetId: "restated-set" },
      }),
      "revenue",
      2,
    );
    expect(reasons(mismatched)).toContain("unit_evidence_missing");
    expect(reasons(mismatched)).toContain("unsupported_unit");
    expect(reasons(mismatched)).toContain("revision_set_mismatch");
    expect(assessed(mismatched).metrics[1]?.status).toBe("compatible_inputs");
  });

  it("preserves exact large, fractional, negative, and zero input strings", () => {
    const values = [
      "9".repeat(64),
      "-0.000000000000000000000000000000000000000000000000000000000001",
      "-5.4500",
      "0",
    ];
    const value = input();
    const result = revenue({
      ...value,
      quarters: value.quarters.map((period, index) => ({
        ...period,
        reported: {
          ...period.reported,
          revenue: { ...period.reported.revenue, value: values[index]! },
        },
      })),
    });
    expect(result.status).toBe("compatible_inputs");
    expect(result.periods.map((period) => period.value)).toEqual(values);
  });

  it("does not use statement dates as period or revision evidence", () => {
    const value = input();
    expect(
      revenue({
        ...value,
        quarters: value.quarters.map((period) => ({
          ...period,
          statementDate: null,
        })),
      }).status,
    ).toBe("compatible_inputs");
    const unknown = changeEvidence(value, (prior) => ({
      ...prior,
      period: null,
      source: null,
    }));
    expect(reasons(unknown)).toEqual([
      "period_evidence_missing",
      "source_revision_evidence_missing",
    ]);
  });

  it("accepts catalog identifiers at the existing 128-character bound", () => {
    const issuerId = "i".repeat(128);
    const value = input();
    const bounded = {
      ...value,
      security: { issuerId, listingId: "l".repeat(128) },
      quarters: value.quarters.map((period) => ({
        ...period,
        reported: Object.fromEntries(
          Object.entries(period.reported).map(([metric, cell]) => [
            metric,
            {
              ...cell,
              evidence: {
                ...cell.evidence!,
                scope: { ...cell.evidence!.scope!, issuerId },
              },
            },
          ]),
        ) as PersonalQuarterlyCompatibilityQuarterInput["reported"],
      })),
    };
    expect(
      assessed(bounded).metrics.every(
        (metric) => metric.status === "compatible_inputs",
      ),
    ).toBe(true);
    expectQuarantine({
      ...bounded,
      security: { ...bounded.security, listingId: "l".repeat(129) },
    });
    expectQuarantine(
      changeEvidence(bounded, (prior) => ({
        ...prior,
        scope: { ...prior.scope!, issuerId: "i".repeat(129) },
      })),
    );
  });

  it("handles the sixteen-quarter bound while assessing only the anchored four", () => {
    const value = input();
    const quarters = Array.from({ length: 16 }, (_, offset) => {
      const ordinal = 2026 * 4 - offset;
      return quarter(
        Math.floor(ordinal / 4),
        ((ordinal % 4) + 1) as 1 | 2 | 3 | 4,
      );
    });
    expect(assessed({ ...value, quarters })).toEqual(assessed(value));
    expectQuarantine(
      { ...value, quarters: [...quarters, quarter(2021, 4)] },
      "too_many_quarters",
    );
  });

  it("freezes copied output without mutating or freezing caller input", () => {
    const value = changeEvidence(input(), () => null);
    const before = structuredClone(value);
    const result = assessed(value);
    expect(value).toEqual(before);
    expect(Object.isFrozen(value.security)).toBe(false);
    expect(Object.isFrozen(value.quarters)).toBe(false);
    const checkFrozen = (current: unknown): void => {
      if (typeof current !== "object" || current === null) return;
      expect(Object.isFrozen(current)).toBe(true);
      for (const child of Object.values(current)) checkFrozen(child);
    };
    checkFrozen(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe("quarterly compatibility defensive input validation", () => {
  it.each([1, 2, 3] as const)(
    "rejects a lower-bound anchor Q%i whose slots would leave supported fiscal years",
    (fiscalQuarter) => {
      expectQuarantine({
        ...input(),
        anchor: { fiscalYear: 1000, fiscalQuarter },
        quarters: [],
      });
    },
  );

  it("keeps every output slot within bounds at the earliest complete fiscal year", () => {
    const result = assessed({
      ...input(),
      anchor: { fiscalYear: 1000, fiscalQuarter: 4 },
      quarters: [],
    });
    expect(result.slots.map((slot) => slot.fiscalYear)).toEqual([
      1000, 1000, 1000, 1000,
    ]);
  });

  it.each([
    null,
    undefined,
    [],
    {},
    { ...input(), extra: true },
    { ...input(), anchor: { fiscalYear: 2026, fiscalQuarter: 0 } },
    { ...input(), anchor: { fiscalYear: 2026.5, fiscalQuarter: 1 } },
    { ...input(), security: { issuerId: "", listingId: "listing-a" } },
  ])("quarantines invalid input %#", (value) => {
    expectQuarantine(value);
  });

  it("rejects duplicate coordinates even outside the selected window", () => {
    const value = input();
    expectQuarantine(
      {
        ...value,
        quarters: [...value.quarters, quarter(2024, 4), quarter(2024, 4)],
      },
      "duplicate_fiscal_coordinate",
    );
  });

  it.each([
    "+1",
    "1e3",
    "01",
    ".1",
    "1.",
    "NaN",
    "Infinity",
    "9".repeat(65),
    12,
  ])("rejects invalid decimal %s", (badValue) => {
    const value = input();
    const first = value.quarters[0]!;
    expectQuarantine({
      ...value,
      quarters: [
        {
          ...first,
          reported: {
            ...first.reported,
            revenue: { ...first.reported.revenue, value: badValue },
          },
        },
        ...value.quarters.slice(1),
      ],
    });
  });

  it.each([
    [
      "period",
      {
        startDate: "2025-02-29",
        endDate: "2025-06-30",
        basis: "standalone_quarter",
      },
    ],
    [
      "period",
      {
        startDate: "2025-07-01",
        endDate: "2025-06-30",
        basis: "standalone_quarter",
      },
    ],
    [
      "period",
      { startDate: "2025-04-01", endDate: "2025-06-30", basis: "unknown" },
    ],
    [
      "fiscalCalendar",
      {
        id: "calendar",
        kind: "calendar_months",
        fiscalYearStart: "2025-13-01",
      },
    ],
    ["unit", { currency: "usd", unit: "USD", scalePower10: 0 }],
    ["unit", { currency: "USD", unit: "USD", scalePower10: 19 }],
    ["unit", { currency: "USD", unit: "USD", scalePower10: 0.5 }],
    [
      "scope",
      {
        issuerId: "issuer-a",
        consolidation: "consolidated",
        dimensions: ["x", "x"],
      },
    ],
    [
      "scope",
      {
        issuerId: "issuer-a",
        consolidation: "consolidated",
        dimensions: Array(1),
      },
    ],
    [
      "scope",
      {
        issuerId: "issuer-a",
        consolidation: "consolidated",
        dimensions: Array.from({ length: 17 }, (_, index) => String(index)),
      },
    ],
    [
      "concept",
      {
        taxonomy: "us-gaap",
        code: "Revenue\n",
        signConvention: "reported_signed",
      },
    ],
    [
      "source",
      {
        id: "source",
        reference: "x".repeat(513),
        revisionId: "r",
        revisionSetId: "set",
      },
    ],
    [
      "source",
      { id: "source", reference: "ref", revisionId: "", revisionSetId: "set" },
    ],
    [
      "source",
      {
        id: "source",
        reference: "ref",
        revisionId: "r",
        revisionSetId: "set",
        trusted: true,
      },
    ],
  ])("rejects malformed or oversized %s metadata %#", (group, replacement) => {
    const value = changeEvidence(input(), (prior) => ({
      ...prior,
      [group]: replacement,
    }));
    expectQuarantine(value);
  });

  it("validates rows outside the selected window instead of hiding malformed input", () => {
    const old = quarter(2024, 4);
    expectQuarantine({
      ...input(),
      quarters: [...input().quarters, { ...old, statementDate: "2025-02-30" }],
    });
  });

  it("rejects sparse quarter arrays and extra reported fields", () => {
    expectQuarantine({ ...input(), quarters: Array(4) });
    const first = input().quarters[0]!;
    expectQuarantine({
      ...input(),
      quarters: [
        {
          ...first,
          reported: {
            ...first.reported,
            assets: { value: "100", evidence: null },
          },
        },
      ],
    });
  });
});
