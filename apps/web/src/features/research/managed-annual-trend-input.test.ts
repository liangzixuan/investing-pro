import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualEvidenceResponseDto,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  MANAGED_ANNUAL_TREND_METRICS,
  projectManagedAnnualTrend,
} from "./managed-annual-trend-input";
import {
  annualComparativeRows,
  annualHistoryRows,
  response,
  row,
} from "./sec-annual-evidence-fixture";

function ready(
  packet: PersonalSecAnnualEvidenceResponseDto,
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  const result = projectManagedAnnualTrend(packet, concept);
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("Expected an admitted trend");
  return result;
}

describe("projectManagedAnnualTrend", () => {
  it("keeps three exact same-filing periods in chronological chart order", async () => {
    const packet = await response(annualHistoryRows());
    const trend = ready(packet);
    expect(
      trend.periods.map(({ startDate, endDate, revenue, netIncome }) => ({
        startDate,
        endDate,
        revenue,
        netIncome,
      })),
    ).toEqual([
      {
        startDate: "2023-01-01",
        endDate: "2023-12-31",
        revenue: "640",
        netIncome: "32",
      },
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        revenue: "800",
        netIncome: "80",
      },
      {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        revenue: "1000",
        netIncome: "100",
      },
    ]);
    expect(trend).toMatchObject({
      concept: "Revenues",
      accessionNumber: "0000000001-26-000001",
      completedAt: "2026-09-20T00:00:02.000Z",
      unit: "USD",
      stoppedReason: null,
      plots: {
        revenue: { status: "ready", values: [640, 800, 1000] },
        net_income: { status: "ready", values: [32, 80, 100] },
      },
    });
    expect(Object.keys(trend.plots)).toEqual(MANAGED_ANNUAL_TREND_METRICS);
    expect(
      trend.periods.flatMap((period) => period.observationIds).sort(),
    ).toEqual(
      packet.evidence.observations.map((observation) => observation.id).sort(),
    );
  });

  it("keeps two admitted periods when the third is missing or conflicted", async () => {
    const missing = ready(await response(annualComparativeRows()));
    expect(missing.periods).toHaveLength(2);
    expect(missing.stoppedReason).toBe("previous_period_missing");
    const rows = annualHistoryRows();
    const conflicted = ready(
      await response([...rows, { ...rows[4]!, value: "641" }]),
    );
    expect(conflicted.periods).toHaveLength(2);
    expect(conflicted.plots.revenue).toEqual({
      status: "ready",
      values: [800, 1000],
    });
    expect(conflicted.stoppedReason).toBe("previous_values_conflicted");
  });

  it("does not turn a current pair or noncontiguous older period into a trend", async () => {
    for (const rows of [
      [row(), row("NetIncomeLoss", "100")],
      annualHistoryRows().filter((item) => item.endDate !== "2024-12-31"),
    ]) {
      expect(
        projectManagedAnnualTrend(await response(rows), "Revenues"),
      ).toEqual({
        status: "unavailable",
        reason: "insufficient_periods",
        stoppedReason: "previous_period_missing",
      });
    }
  });

  it("preserves exact admitted dates without inferring calendar-year slots", async () => {
    const rows = annualComparativeRows().map((item) =>
      item.endDate === "2025-12-31"
        ? { ...item, startDate: "2025-01-02", durationDays: 364 }
        : {
            ...item,
            startDate: "2024-01-02",
            endDate: "2025-01-01",
            durationDays: 366,
          },
    );
    expect(
      ready(await response(rows)).periods.map(({ startDate, endDate }) => [
        startDate,
        endDate,
      ]),
    ).toEqual([
      ["2024-01-02", "2025-01-01"],
      ["2025-01-02", "2025-12-31"],
    ]);
  });

  it("keeps every named revenue basis separate even when dates and income match", async () => {
    const rows = annualHistoryRows();
    const packet = await response([
      ...rows.filter((item) => item.metric === "net_income"),
      ...PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.flatMap((concept, index) =>
        rows
          .filter((item) => item.metric === "revenue")
          .map((item) => ({
            ...item,
            concept,
            sourceLocator: item.sourceLocator.replace(
              "/Revenues/",
              `/${concept}/`,
            ),
            value: String(Number(item.value) * (index + 1)),
          })),
      ),
    ]);
    const trends = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) =>
      ready(packet, concept),
    );
    expect(trends.map((trend) => trend.plots.revenue)).toEqual([
      { status: "ready", values: [640, 800, 1000] },
      { status: "ready", values: [1280, 1600, 2000] },
      { status: "ready", values: [1920, 2400, 3000] },
    ]);
    expect(new Set(trends.map((trend) => trend.contentKey)).size).toBe(3);
  });

  it("does not borrow another basis's older revenue or admit another filing", async () => {
    const mixed = await response(
      annualHistoryRows().map((item) =>
        item.metric === "revenue" && item.endDate !== "2025-12-31"
          ? {
              ...item,
              concept: "SalesRevenueNet" as const,
              sourceLocator: item.sourceLocator.replace(
                "/Revenues/",
                "/SalesRevenueNet/",
              ),
            }
          : item,
      ),
    );
    expect(projectManagedAnnualTrend(mixed, "Revenues")).toMatchObject({
      status: "unavailable",
      reason: "insufficient_periods",
      stoppedReason: "previous_period_missing",
    });
    const packet = await response(annualHistoryRows());
    const wrongFiling = {
      ...packet,
      evidence: {
        ...packet.evidence,
        observations: packet.evidence.observations.map((item) =>
          item.endDate === "2024-12-31"
            ? { ...item, accessionNumber: "0000000001-25-000001" }
            : item,
        ),
      },
    };
    expect(() => projectManagedAnnualTrend(wrongFiling, "Revenues")).toThrow(
      "Invalid annual SEC evidence input",
    );
  });

  it("preserves missing-basis and current-use refusal rather than plotting historical pairs", async () => {
    expect(
      projectManagedAnnualTrend(
        await response(annualHistoryRows()),
        "SalesRevenueNet",
      ),
    ).toEqual({
      status: "unavailable",
      reason: "current_report_unavailable",
      stoppedReason: null,
    });
    const old = await response(annualHistoryRows(), "2027-09-20T00:00:00.000Z");
    expect(old.evidence.resolution.selectedReportPairEligible).toBe(true);
    expect(projectManagedAnnualTrend(old, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
      stoppedReason: null,
    });
  });

  it("withholds a refused source response", async () => {
    const packet = await response([]);
    const refused: PersonalSecAnnualEvidenceResponseDto = {
      ...packet,
      evidence: {
        ...packet.evidence,
        completeness: { status: "refused", reason: "source_unavailable" },
        coverage: null,
        generation: {
          ...packet.evidence.generation,
          sources: {
            ...packet.evidence.generation.sources,
            companyFacts: {
              ...packet.evidence.generation.sources.companyFacts,
              status: "upstream_unavailable",
              fetchedAt: null,
              sha256: null,
              bytes: null,
            },
          },
        },
      },
    };
    expect(projectManagedAnnualTrend(refused, "Revenues")).toEqual({
      status: "unavailable",
      reason: "current_report_unavailable",
      stoppedReason: null,
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
    "retains exact signed or zero amount %s with an approximate safe coordinate",
    async (value) => {
      const trend = ready(
        await response(
          annualComparativeRows().map((item) =>
            item.metric === "net_income" || item.endDate === "2024-12-31"
              ? { ...item, value }
              : item,
          ),
        ),
      );
      expect(trend.periods.map((period) => period.revenue)).toEqual([
        value,
        "1000",
      ]);
      expect(trend.periods.map((period) => period.netIncome)).toEqual([
        value,
        value,
      ]);
      expect(trend.plots.revenue).toEqual({
        status: "ready",
        values: [Number(value), 1000],
      });
      expect(trend.plots.net_income).toEqual({
        status: "ready",
        values: [Number(value), Number(value)],
      });
    },
  );

  it.each(["0", "-1"])(
    "retains the resolver's refusal of nonpositive current revenue %s",
    async (value) => {
      const packet = await response(
        annualComparativeRows().map((item) =>
          item.metric === "revenue" && item.endDate === "2025-12-31"
            ? { ...item, value }
            : item,
        ),
      );
      expect(
        packet.evidence.resolution.bases.find(
          (basis) => basis.concept === "Revenues",
        )?.pairs[0]?.status,
      ).toBe("nonpositive_revenue");
      expect(projectManagedAnnualTrend(packet, "Revenues")).toEqual({
        status: "unavailable",
        reason: "current_report_unavailable",
        stoppedReason: null,
      });
    },
  );

  it.each([
    "9007199254740991.1",
    "-9007199254740991.1",
    "9007199254740992",
    "-9007199254740992",
    "9007199254740991.0000000000000000000000001",
    "9".repeat(64),
  ])(
    "withholds only the unsafe metric for %s while preserving all exact amounts",
    async (value) => {
      for (const metric of MANAGED_ANNUAL_TREND_METRICS) {
        const trend = ready(
          await response(
            annualComparativeRows().map((item) =>
              item.metric === metric && item.endDate === "2024-12-31"
                ? { ...item, value }
                : item,
            ),
          ),
        );
        expect(trend.plots[metric]).toEqual({
          status: "unavailable",
          reason: "unsafe_plot_value",
        });
        expect(
          trend.periods[0]?.[metric === "revenue" ? "revenue" : "netIncome"],
        ).toBe(value);
        expect(
          trend.plots[metric === "revenue" ? "net_income" : "revenue"].status,
        ).toBe("ready");
      }
    },
  );

  it("keys exact values even when their plotted coordinates round to the same number", async () => {
    const original = await response(
      annualComparativeRows().map((item) => ({
        ...item,
        value: "100.000000000000000001",
      })),
    );
    const changed = await response(
      annualComparativeRows().map((item) => ({
        ...item,
        value: "100.000000000000000002",
      })),
    );
    expect(ready(original).plots).toEqual(ready(changed).plots);
    expect(ready(original).contentKey).not.toBe(ready(changed).contentKey);
  });

  it("uses stable source-bound keys for equivalent renders and replaces them on identity or generation changes", async () => {
    const packet = await response(annualHistoryRows());
    const original = ready(packet).contentKey;
    expect(ready(structuredClone(packet)).contentKey).toBe(original);
    expect(
      ready({
        ...packet,
        security: { ...packet.security, listingId: "listing-other" },
      }).contentKey,
    ).not.toBe(original);
    expect(
      ready({ ...packet, catalogSnapshotSha256: `sha256:${"d".repeat(64)}` })
        .contentKey,
    ).not.toBe(original);
    const refreshed = await response(
      annualHistoryRows(),
      "2026-09-21T00:00:00.000Z",
    );
    expect(ready(refreshed).plots).toEqual(ready(packet).plots);
    expect(ready(refreshed).contentKey).not.toBe(original);
  });

  it("does not mutate the packet or expose mutable returned arrays", async () => {
    const packet = deepFreeze(await response(annualHistoryRows()));
    const before = JSON.stringify(packet);
    const trend = ready(packet);
    expect(JSON.stringify(packet)).toBe(before);
    expect(Object.isFrozen(trend)).toBe(true);
    expect(Object.isFrozen(trend.periods)).toBe(true);
    for (const period of trend.periods) {
      expect(Object.isFrozen(period)).toBe(true);
      expect(Object.isFrozen(period.observationIds)).toBe(true);
    }
    expect(Object.isFrozen(trend.plots)).toBe(true);
    for (const plot of Object.values(trend.plots)) {
      expect(Object.isFrozen(plot)).toBe(true);
      if (plot.status === "ready")
        expect(Object.isFrozen(plot.values)).toBe(true);
    }
  });
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
