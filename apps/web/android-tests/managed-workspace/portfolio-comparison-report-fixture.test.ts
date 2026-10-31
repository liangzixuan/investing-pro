import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  preparePortfolioComparisonReport,
  isPreparedPortfolioComparisonReport,
} from "../../src/clerk-trial/portfolio-comparison-report";
import { PortfolioComparisonReportSnapshot } from "../../src/clerk-trial/PortfolioComparisonReportSnapshot";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { capturePortfolioCloseContext } from "../../src/clerk-trial/portfolio-close-review-context";
import { admitPortfolioReviewReport } from "../../src/clerk-trial/portfolio-review-report-admission";
import { archiveHtmlFixture } from "../../src/clerk-trial/portfolio-report-archive-fixture";
import {
  parsePortfolioReportArchive,
  isPortfolioReportArchive,
} from "../../src/clerk-trial/portfolio-report-archive";
import { comparePortfolioReports } from "../../src/clerk-trial/portfolio-report-comparison";
import { createFixture } from "./fixture";
import {
  portfolioComparisonIds as ids,
  portfolioComparisonNote,
} from "./portfolio-report-comparison-fixture-data";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  workspaces.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
async function started() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00.000Z"));
  const fixture = await createFixture("portfolio-comparison-report");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  workspaces.push(workspace);
  workspace.setView("portfolio");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  return { fixture, workspace, control: fixture.portfolioReportComparison! };
}
async function report(workspace: ManagedWorkspace, preparedAt: string) {
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  const prices = workspace.createPortfolioCloseReview();
  const context = capturePortfolioCloseContext(workspace);
  expect(context).not.toBeNull();
  prices.enter(context);
  await prices.load();
  expect(
    prices.getSnapshot().dates.length,
    JSON.stringify(prices.getSnapshot()),
  ).toBe(2);
  admitPortfolioReviewReport({
    ledger: context!.ledger,
    portfolio: context!.portfolio,
    state: prices.getSnapshot(),
    review: prices.review()!,
    preparedAt,
  });
  const capture = prices.captureReport(preparedAt);
  expect(capture).not.toBeNull();
  return { prices, capture: capture! };
}
describe("invented complete Portfolio comparison reading report", () => {
  it("captures both complete original records and full passive union from the strict saved/current native setup without saving", async () => {
    const { workspace, control } = await started();
    workspace.note("listing-zero", portfolioComparisonNote);
    const watchlist = workspace.coordinator.getSnapshot().draft;
    const before = await report(workspace, "2026-10-30T12:00:01.000Z");
    expect(before.capture.report.review).toMatchObject({
      holdingsValueUsd: "120.50",
      cashUsd: "100.00",
      totalValueUsd: "220.50",
    });
    const bytes = new TextEncoder().encode(
      archiveHtmlFixture(before.capture.report),
    );
    const archived = parsePortfolioReportArchive(Uint8Array.from(bytes).buffer);
    expect(isPortfolioReportArchive(archived)).toBe(true);
    expect(archived).toEqual(before.capture.report);
    expect(archived.ledger.opening.holdings.map((r) => r.shares)).toEqual([
      "2.000000",
      "1.000000",
      "4.000000",
    ]);
    const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
    workspace.portfolio.replace(draft, control.current.payload);
    control.changeCurrent();
    before.prices.retire();
    const after = await report(workspace, "2026-10-30T12:00:02.000Z");
    expect(after.capture.report.review).toMatchObject({
      cashUsd: "0.00",
      totalValueUsd: null,
    });
    const comparison = comparePortfolioReports(archived, after.capture.report);
    const captured = preparePortfolioComparisonReport(
      comparison,
      "Invented private baseline.html",
      "2026-10-30T12:00:03.000Z",
    );
    expect(captured).not.toBeNull();
    expect(isPreparedPortfolioComparisonReport(captured)).toBe(true);
    expect(captured?.comparison).toBe(comparison);
    expect(captured?.comparison.saved).toBe(archived);
    expect(captured?.comparison.current).toBe(after.capture.report);
    // Passive renderer qualification only. The native case checks the genuine detached formatter/bridge/output bytes.
    const markup = renderToStaticMarkup(
      createElement(PortfolioComparisonReportSnapshot, { report: captured! }),
    );
    for (const label of [
      "Complete saved report: unverified private evidence",
      "Complete current captured report",
      "Complete listing comparison",
      "Invented private baseline.html",
      "3.500000",
      "2.000000",
      "0.00",
      "100.00",
    ])
      expect(markup).toContain(label);
    expect(markup.match(/data-portfolio-comparison-row=/gu)).toHaveLength(4);
    expect(markup).toContain('data-portfolio-comparison-document="1"');
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<script");
    expect(markup).toContain("&lt;script&gt;literal&lt;/script&gt;");

    expect(comparison.rows.map((r) => [r.listingId, r.status])).toEqual([
      [ids.a, "both"],
      [ids.c, "both"],
      [ids.past, "saved-only"],
      [ids.added, "current-only"],
    ]);
    expect(comparison.rows[0]!.saved!.line).toMatchObject({
      shares: "2",
      close: "20.25",
      valueUsd: "40.50",
      confirmedOn: "2026-10-02",
    });
    expect(comparison.rows[0]!.current!.line).toMatchObject({
      shares: "3.5",
      close: "25.5",
      valueUsd: "89.25",
      confirmedOn: "2026-10-05",
    });
    expect(comparison.rows[1]!.current!.line).toMatchObject({
      shares: "1.25",
      close: "50",
      valueUsd: "62.50",
    });
    expect(comparison.rows[3]!.current!.line.close).toBeNull();
    expect(comparison.rows[3]!.current!.sourceRow.available).toBe(false);
    expect(comparison.current.ledger.opening.holdings[0]!.shares).toBe(
      "3.500000",
    );
    expect(control.getSnapshot()).toMatchObject({
      status: 1,
      load: 1,
      portfolioLoad: 1,
      resolve: 2,
      eod: 5,
      rejected: 0,
    });
    expect(
      control.getSnapshot().requests.map((r) => [r.listingId, r.current]),
    ).toEqual([
      [ids.a, false],
      [ids.c, false],
      [ids.past, false],
      [ids.a, true],
      [ids.c, true],
    ]);
    expect(workspace.portfolio.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 3,
      dirty: true,
      saved: { version: 3, payload: { ledger: control.baseline.payload } },
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    const retained = workspace.portfolio.coordinator.getSnapshot();
    workspace.openPortfolioResearch(
      retained.draft!,
      retained.draft!.ledger!.identities[0]!,
    );
    expect(workspace.getSnapshot().research?.selection).toMatchObject({
      origin: "portfolio",
      listing: control.current.payload.identities[0],
    });
    workspace.closeResearch();
    expect(workspace.portfolio.coordinator.getSnapshot()).toBe(retained);
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(control.getSnapshot()).toMatchObject({
      resolve: 2,
      eod: 5,
      rejected: 0,
    });
    after.prices.retire();
  });
  it("refuses an extra source request, unsupported sources and all implicit personal writes", async () => {
    const { fixture, control } = await started();
    const signal = new AbortController().signal;
    await expect(
      fixture.api.savePortfolio({} as never, signal),
    ).rejects.toThrow(
      "Unexpected invented saved Portfolio comparison operation",
    );
    await expect(fixture.api.annualReport({} as never, signal)).rejects.toThrow(
      "Unexpected invented saved Portfolio comparison operation",
    );
    await expect(fixture.api.loadPortfolio(signal)).rejects.toThrow(
      "Unexpected invented saved Portfolio comparison operation",
    );
    expect(control.getSnapshot().rejected).toBe(3);
  });
  it("refuses current setup before the complete baseline and rejects aborted exact operations", async () => {
    const { fixture, control } = await started();
    expect(() => control.changeCurrent()).toThrow(
      "Unexpected invented saved Portfolio comparison operation",
    );
    const abort = new AbortController();
    abort.abort();
    await expect(
      fixture.api.resolve(
        {
          snapshotSha256: control.baseline.payload.snapshotSha256,
          listingIds: [ids.a],
        },
        abort.signal,
      ),
    ).rejects.toThrow(
      "Unexpected invented saved Portfolio comparison operation",
    );
    expect(control.getSnapshot().eod).toBe(0);
  });
});
