import { describe, expect, it } from "vitest";
import type { PersonalSecAnnualCashObservationDto } from "@research-cockpit/contracts";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";
import {
  annualCashHistoryRows,
  cashGeneration,
  cashResponse,
} from "./sec-annual-cash-fixture";
import { response as incomeResponse } from "./sec-annual-evidence-fixture";
import {
  cashTrendChartInput,
  projectManagedAnnualCashTrend,
} from "./managed-annual-cash-trend-input";
import { annualTrendTooltip } from "./managed-annual-trend-chart-option";

async function decoded(rows = annualCashHistoryRows(), cutoff?: string) {
  const counts = { operating_cash_flow: 0, ppe_purchases: 0 };
  const sourceRows = rows.map((row) => ({
    ...row,
    sourceLocator: row.sourceLocator.replace(
      /\/\d+$/u,
      `/${counts[row.metric]++}`,
    ),
  }));
  return admit(await cashResponse(sourceRows, cutoff));
}
async function admit(raw: Awaited<ReturnType<typeof cashResponse>>) {
  const parsed = await parseSecAnnualEvidenceResponse(
    raw,
    {
      schemaVersion: "5.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  );
  if (!parsed) throw new Error("Invented cash trend packet was refused");
  return parsed;
}
function ready(packet: Awaited<ReturnType<typeof decoded>>) {
  const projection = projectManagedAnnualCashTrend(packet);
  expect(projection.status).toBe("ready");
  if (projection.status !== "ready") throw new Error("Expected cash trend");
  return projection;
}

describe("managed cash trend projection", () => {
  it("retains three exact same-filing periods and all references in oldest-first order", async () => {
    const packet = await decoded();
    const before = JSON.stringify(packet);
    const trend = ready(packet);
    expect(
      trend.periods.map((p) => [
        p.startDate,
        p.endDate,
        p.operatingCashFlow,
        p.ppePurchases,
        p.operatingCashFlowLessPpePurchases,
      ]),
    ).toEqual([
      ["2023-01-01", "2023-12-31", "500", "750", "-250"],
      ["2024-01-01", "2024-12-31", "-50", "0", "-50"],
      ["2025-01-01", "2025-12-31", "120.125", "20.025", "100.1"],
    ]);
    expect(trend).toMatchObject({
      unit: "USD",
      accessionNumber: "0000000001-26-000001",
      completedAt: "2026-09-20T00:00:02.000Z",
      stoppedReason: null,
      plots: {
        operatingCashFlow: { status: "ready", values: [500, -50, 120.125] },
        ppePurchases: { status: "ready", values: [750, 0, 20.025] },
        operatingCashFlowLessPpePurchases: {
          status: "ready",
          values: [-250, -50, 100.1],
        },
      },
    });
    expect(trend.periods.flatMap((p) => p.observationIds).sort()).toEqual(
      [
        ...packet.evidence.cashGeneration.operatingCashFlow.observations,
        ...packet.evidence.cashGeneration.ppePurchases.observations,
      ]
        .map((row) => row.id)
        .sort(),
    );
    expect(JSON.stringify(packet)).toBe(before);
    expect(Object.isFrozen(trend)).toBe(true);
    expect(Object.isFrozen(trend.periods)).toBe(true);
    expect(Object.isFrozen(trend.plots)).toBe(true);
    for (const period of trend.periods) {
      expect(Object.isFrozen(period)).toBe(true);
      expect(Object.isFrozen(period.observationIds)).toBe(true);
    }
  });

  it("keeps two periods when the third is refused but never bridges a missing middle period", async () => {
    const two = ready(
      await decoded(
        annualCashHistoryRows().filter((r) => r.endDate !== "2023-12-31"),
      ),
    );
    expect(two.periods).toHaveLength(2);
    expect(two.stoppedReason).toBe("no_report_period");
    expect(
      projectManagedAnnualCashTrend(
        await decoded(
          annualCashHistoryRows().filter((r) => r.endDate !== "2024-12-31"),
        ),
      ),
    ).toEqual({
      status: "unavailable",
      reason: "insufficient_periods",
      stoppedReason: "no_report_period",
    });
    const refusedThird = ready(
      await decoded(
        annualCashHistoryRows().map((r) =>
          r.endDate === "2023-12-31" && r.metric === "ppe_purchases"
            ? { ...r, value: "-1" }
            : r,
        ),
      ),
    );
    expect(refusedThird.periods).toHaveLength(2);
    expect(refusedThird.stoppedReason).toBe("unsupported_sign");
  });

  it("keeps source and current-use refusals without borrowing income eligibility", async () => {
    expect(
      projectManagedAnnualCashTrend(await decoded([], undefined)),
    ).toMatchObject({ status: "unavailable", reason: "concept_missing" });
    expect(
      projectManagedAnnualCashTrend(
        await decoded(undefined, "2028-09-20T00:00:00.000Z"),
      ),
    ).toEqual({
      status: "unavailable",
      reason: "current_use_unavailable",
      stoppedReason: null,
    });
    const base = await incomeResponse([]);
    const packet = await admit({
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(
          base.evidence,
          annualCashHistoryRows(),
        ),
      },
    });
    expect(packet.evidence.resolution.selectedReportPairEligible).toBe(false);
    expect(ready(packet).periods).toHaveLength(3);
    // Typed model probe: the real parser does not admit this malformed clock.
    expect(
      projectManagedAnnualCashTrend({
        ...packet,
        evidence: {
          ...packet.evidence,
          generation: { ...packet.evidence.generation, completedAt: "invalid" },
        },
      }),
    ).toEqual({
      status: "unavailable",
      reason: "invalid_clock",
      stoppedReason: null,
    });
  });

  it("preserves admitted 53-week dates without inventing calendar-year boundaries", async () => {
    const dates: Readonly<Record<string, readonly [string, string, number]>> = {
      "2025-12-31": ["2024-12-26", "2025-12-31", 371],
      "2024-12-31": ["2023-12-28", "2024-12-25", 364],
    };
    const rows = annualCashHistoryRows()
      .filter((r) => r.endDate !== "2023-12-31")
      .map((r) => {
        const [startDate, endDate, durationDays] = dates[r.endDate]!;
        return { ...r, startDate, endDate, durationDays };
      });
    expect(
      ready(await decoded(rows)).periods.map((p) => [p.startDate, p.endDate]),
    ).toEqual([
      ["2023-12-28", "2024-12-25"],
      ["2024-12-26", "2025-12-31"],
    ]);
  });

  it("withholds only an unsafe metric, including a subtraction of two safely plotted operands", async () => {
    const amounts = (r: PersonalSecAnnualCashObservationDto) => ({
      ...r,
      value:
        r.metric === "operating_cash_flow"
          ? "-9007199254740991"
          : "9007199254740991",
    });
    const trend = ready(await decoded(annualCashHistoryRows().map(amounts)));
    expect(trend.plots.operatingCashFlow.status).toBe("ready");
    expect(trend.plots.ppePurchases.status).toBe("ready");
    expect(trend.plots.operatingCashFlowLessPpePurchases).toEqual({
      status: "unavailable",
      reason: "unsafe_plot_value",
    });
    expect(trend.periods[0]!.operatingCashFlowLessPpePurchases).toBe(
      "-18014398509481982",
    );
    const huge = ready(
      await decoded(
        annualCashHistoryRows().map((r) => ({
          ...r,
          value: r.metric === "operating_cash_flow" ? "9".repeat(64) : "0",
        })),
      ),
    );
    expect(huge.plots.operatingCashFlow.status).toBe("unavailable");
    expect(huge.plots.ppePurchases).toEqual({
      status: "ready",
      values: [0, 0, 0],
    });
  });

  it("keys exact values, identities, clocks and selected metrics independently of approximate coordinates", async () => {
    const rows = (value: string) =>
      annualCashHistoryRows().map((r) =>
        r.metric === "operating_cash_flow" ? { ...r, value } : r,
      );
    const packet = await decoded(rows("100.000000000000000001"));
    const first = ready(packet);
    const second = ready(await decoded(rows("100.000000000000000002")));
    expect(first.plots).toEqual(second.plots);
    expect(first.contentKey).not.toBe(second.contentKey);
    expect(ready(structuredClone(packet)).contentKey).toBe(first.contentKey);
    expect(
      ready({
        ...packet,
        security: {
          ...packet.security,
          securityName: "Another exact share class",
        },
      }).contentKey,
    ).not.toBe(first.contentKey);
    expect(
      ready(
        await decoded(
          rows("100.000000000000000001"),
          "2026-09-21T00:00:00.000Z",
        ),
      ).contentKey,
    ).not.toBe(first.contentKey);
    const input = cashTrendChartInput(first, "operatingCashFlow");
    expect(input.contentKey).not.toBe(
      cashTrendChartInput(first, "ppePurchases").contentKey,
    );
    expect(
      annualTrendTooltip(input, { dataIndex: 0 }).replaceAll("\n", ""),
    ).toContain("USD: 100.000000000000000001");
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.periods[0])).toBe(true);
  });
});
