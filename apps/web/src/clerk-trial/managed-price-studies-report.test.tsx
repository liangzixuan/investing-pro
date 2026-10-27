import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import type { PersonalMarketAnalyticsResult } from "@research-cockpit/personal-market-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import {
  companyReportIsCurrent,
  prepareCompanyReport,
} from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { ManagedEodHistory } from "./managed-eod-history";
import type { ResearchWatchlistState } from "./managed-workspace";

interface CapturedDocument {
  readonly schemaVersion: string;
  readonly sources: {
    readonly price: {
      readonly response: ManagedEodHistoryResponseDto;
      readonly studies: {
        readonly status: string;
        readonly calculation: PersonalMarketAnalyticsResult;
      };
    };
  };
}

async function fixture() {
  // A mutable provider result still passes the real model's response admission.
  // This lets the second test exercise fingerprint ownership after capture.
  const rows = Array.from({ length: 252 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, 11 + index)).toISOString().slice(0, 10),
    close: index === 251 ? "110" : "100",
  }));
  const packet = { ...eodResponse("1y"), rows };
  const priceRead = vi.fn().mockResolvedValue(packet);
  const annualRead = vi.fn();
  const filingsRead = vi.fn();
  const price = new ManagedEodHistory(priceRead, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(annualRead, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  const filings = new ManagedCompanyFilings(filingsRead, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  for (const model of [price, annual, filings]) model.open(eodSelection);
  price.selectRange("1y");
  await price.load();
  expect(price.getSnapshot().response).toBe(packet);
  const evidence = companySnapshotEvidence(
    eodSelection,
    price.getSnapshot(),
    annual.getSnapshot(),
    filings.getSnapshot(),
    null,
  );
  const watchlist: ResearchWatchlistState = {
    member: { ...eodSelection.listing, note: "My source review." },
    canEdit: true,
    canAdd: false,
    reason: null,
    revision: Symbol("draft revision"),
  };
  const report = prepareCompanyReport(
    eodSelection,
    evidence,
    watchlist,
    () => new Date("2026-10-17T00:00:00.000Z"),
  );
  if (!report) throw new Error("Expected admitted price report");
  return {
    packet,
    rows,
    price,
    evidence,
    watchlist,
    report,
    priceRead,
    annualRead,
    filingsRead,
  };
}

describe("captured managed raw close studies", () => {
  it("captures one source and all seven independent values and samples in passive HTML", async () => {
    const f = await fixture();
    const document = formatCompanyReportDocument(f.report);
    if (!document) throw new Error("Expected formatted price report");
    const data = JSON.parse(document.text) as CapturedDocument;
    const price = data.sources.price;
    const calculation = price.studies.calculation;
    const metrics = calculation.metrics;
    expect(data.schemaVersion).toBe("6.0.0");
    expect(price.response).toEqual(f.packet);
    expect(price.studies.status).toBe("available");
    expect(document.text.match(/"rows":/gu)).toHaveLength(1);
    expect(document.text.match(/"close":/gu)).toHaveLength(252);
    expect(document.text).not.toContain('"adjusted"');
    expect(calculation).toMatchObject({
      asOfDate: "2026-09-19",
      mode: "raw",
      schemaVersion: "1.0.0",
      formulaSetVersion: "1.0.0",
      inputWindow: {
        firstDate: "2026-01-11",
        lastDate: "2026-09-19",
        sessionCount: 252,
        sessionPolicy: "observed_sessions_only_no_gap_filling",
      },
    });
    expect(calculation.asOfDate).not.toBe(price.response.window.endDate);

    // Independent floating-point oracle for this well-conditioned sample:
    // nineteen zero log returns, followed by log(110 / 100).
    const returns = Array.from({ length: 20 }, (_, index) =>
      Math.log(index === 19 ? 110 / 100 : 1),
    );
    const mean = returns.reduce((sum, value) => sum + value, 0) / 20;
    const variance =
      returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 19;
    const volatility = (Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(4);
    const expected = [
      {
        metric: metrics.selectedWindowReturn,
        label: "Loaded-window raw close change",
        value: "10.0000%",
        sample: "252 observed closes; 2026-01-11 through 2026-09-19",
        count: 252,
        first: "2026-01-11",
        percent: "10.0000",
      },
      {
        metric: metrics.maximumDrawdown,
        label: "Maximum observed drawdown",
        value: "0.0000%",
        sample: "252 observed closes; 2026-01-11 through 2026-09-19",
        count: 252,
        first: "2026-01-11",
        percent: "0.0000",
      },
      {
        metric: metrics.trailing20SessionAnnualizedVolatility,
        label: "Annualized volatility · 20 log returns",
        value: `${volatility}%`,
        sample: "21 observed closes; 2026-08-30 through 2026-09-19",
        count: 21,
        first: "2026-08-30",
        percent: volatility,
      },
      {
        metric: metrics.smaTrend.sma20,
        label: "Last close versus 20-observation SMA",
        value: "above; distance 9.4527%",
        sample: "20 observed closes; 2026-08-31 through 2026-09-19",
        count: 20,
        first: "2026-08-31",
        distance: "9.4527",
      },
      {
        metric: metrics.smaTrend.sma50,
        label: "Last close versus 50-observation SMA",
        value: "above; distance 9.7804%",
        sample: "50 observed closes; 2026-08-01 through 2026-09-19",
        count: 50,
        first: "2026-08-01",
        distance: "9.7804",
      },
      {
        metric: metrics.smaTrend.sma200,
        label: "Last close versus 200-observation SMA",
        value: "above; distance 9.9450%",
        sample: "200 observed closes; 2026-03-04 through 2026-09-19",
        count: 200,
        first: "2026-03-04",
        distance: "9.9450",
      },
      {
        metric: metrics.trailing252SessionCloseRangePosition,
        label: "Trailing observed close-range position",
        value: "100.0000%",
        sample: "252 observed closes; 2026-01-11 through 2026-09-19",
        count: 252,
        first: "2026-01-11",
        percent: "100.0000",
      },
    ];
    for (const entry of expected) {
      expect(entry.metric).toMatchObject({
        status: "available",
        observedSessions: entry.count,
        sampleFirstDate: entry.first,
        sampleLastDate: "2026-09-19",
        formulaVersion: "1.0.0",
        parameters: {
          calculationPrecision:
            "80_significant_decimal_digits_for_arithmetic_logarithms_and_roots",
          roundingDecimalPlaces: 4,
          roundingMethod: "round_half_up",
          percentMultiplier: 100,
          sessionPolicy: "observed_sessions_only_no_gap_filling",
        },
        ...(entry.percent === undefined
          ? { classification: "above", distancePercent: entry.distance }
          : { valuePercent: entry.percent }),
      });
    }
    expect(metrics.maximumDrawdown).toMatchObject({
      peakDate: "2026-01-11",
      troughDate: "2026-01-11",
    });
    expect(new Set(expected.map(({ metric }) => metric.formulaId)).size).toBe(
      7,
    );

    const markup = renderToStaticMarkup(
      <CompanyReportHtmlView report={f.report} jsonText={document.text} />,
    );
    const region =
      /<section class="captured-price-studies"[\s\S]*?<\/section>/u.exec(
        markup,
      )?.[0];
    if (!region) throw new Error("Expected passive captured study section");
    const table = /<tbody>([\s\S]*?)<\/tbody>/u.exec(region)?.[1];
    if (!table) throw new Error("Expected captured study table");
    const renderedRows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)];
    expect(renderedRows).toHaveLength(7);
    for (const [index, entry] of expected.entries()) {
      const row = renderedRows[index]?.[1];
      expect(row).toContain(entry.label);
      expect(row).toContain(`<strong>${entry.value}</strong>`);
      expect(row).toContain(`<small>${entry.sample}</small>`);
    }
    expect(region).toContain("Calculated through 2026-09-19");
    expect(region).toContain("Formula set 1.0.0");
    expect(region).toContain("half-up to four decimal places");
    expect(region).toContain("gaps are not filled");
    expect(region).toContain("not total returns, recommendations or forecasts");
    expect(region).toContain("peak 2026-01-11, trough 2026-01-11");
    expect(region).not.toMatch(
      /<(?:input|button|form|textarea|select|a)(?:\s|>)/u,
    );
    expect(region).not.toMatch(/\s(?:href|src|on\w+)=/u);
    expect(region).not.toContain("Preview complete note");
    expect(region).not.toContain("Add study results");
    expect(markup).toContain(f.packet.requestStartedAt);
    expect(markup).toContain(f.packet.completedAt);
    expect(markup).toContain(f.packet.window.endDate);
    expect(f.priceRead).toHaveBeenCalledOnce();
    expect(f.annualRead).not.toHaveBeenCalled();
    expect(f.filingsRead).not.toHaveBeenCalled();
  });

  it("refuses a changed valid close even when model state and response references stay the same", async () => {
    const f = await fixture();
    const state = f.price.getSnapshot();
    const response = state.response;
    const current = () =>
      companyReportIsCurrent(f.report, eodSelection, f.evidence, f.watchlist);
    expect(current()).toBe(true);
    expect(formatCompanyReportDocument(f.report)).not.toBeNull();
    const last = f.rows.at(-1);
    if (!last) throw new Error("Expected final observed close");
    last.close = "120";
    expect(f.price.getSnapshot()).toBe(state);
    expect(f.price.getSnapshot().response).toBe(response);
    expect(f.evidence.price).toBe(state);
    expect(current()).toBe(false);
    expect(formatCompanyReportDocument(f.report)).toBeNull();
    const replacement = prepareCompanyReport(
      eodSelection,
      f.evidence,
      f.watchlist,
      () => new Date("2026-10-17T00:00:01.000Z"),
    );
    expect(
      replacement?.priceStudies?.calculation.metrics.selectedWindowReturn,
    ).toMatchObject({
      status: "available",
      valuePercent: "20.0000",
    });
    expect(
      f.report.priceStudies?.calculation.metrics.selectedWindowReturn,
    ).toMatchObject({
      status: "available",
      valuePercent: "10.0000",
    });
    expect(f.priceRead).toHaveBeenCalledOnce();
    expect(f.annualRead).not.toHaveBeenCalled();
    expect(f.filingsRead).not.toHaveBeenCalled();
  });
});
