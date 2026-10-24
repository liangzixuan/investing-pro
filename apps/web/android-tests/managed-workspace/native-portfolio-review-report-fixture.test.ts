import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { capturePortfolioCloseContext } from "../../src/clerk-trial/portfolio-close-review-context";
import { createFixture } from "./fixture";
import { authorInventedPortfolioReviewReportLedger } from "./native-portfolio-review-report-fixture";

afterEach(() => vi.useRealTimers());
describe("invented native Portfolio report journey", () => {
  it("requires explicit load and setup, real catalog approval and close request before capture without saving either resource", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
    const fixture = await createFixture("portfolio-review-report");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        priceCoverage: fixture.priceCoverage,
        researchCoverage: fixture.researchCoverage,
      },
    );
    try {
      await workspace.refreshCatalog();
      workspace.setView("portfolio");
      expect(
        authorInventedPortfolioReviewReportLedger(workspace, fixture),
      ).toBe(false);
      await workspace.portfolio.coordinator.load();
      expect(
        authorInventedPortfolioReviewReportLedger(workspace, fixture),
      ).toBe(true);
      expect(
        authorInventedPortfolioReviewReportLedger(workspace, fixture),
      ).toBe(false);
      expect(capturePortfolioCloseContext(workspace)).toBeNull();
      await workspace.portfolio.reviewCatalog();
      workspace.portfolio.applyReview();
      const context = capturePortfolioCloseContext(workspace);
      expect(context).not.toBeNull();
      const prices = workspace.createPortfolioCloseReview();
      prices.enter(context);
      expect(prices.captureReport(new Date().toISOString())).toBeNull();
      await prices.load();
      const capture = prices.captureReport(new Date().toISOString());
      expect(capture?.report.review).toMatchObject({
        holdingsValueUsd: "220.50",
        cashUsd: "948.00",
        totalValueUsd: "1168.50",
      });
      expect(capture?.report.ledger.opening.holdings[0]).toMatchObject({
        shares: "1",
        totalCostBasisUsd: "50.00",
      });
      expect(
        capture?.report.ledger.transactions.map((row) => row.type),
      ).toEqual(["buy", "sell"]);
      expect(capture?.report.ledger.identities[0]?.issuerName).toBe(
        "Zero <script>alert(1)</script> & Company",
      );
      expect(capture?.current()).toBe(true);
      prices.selectDate("2026-10-22");
      expect(capture?.current()).toBe(false);
      expect(fixture.getSnapshot()).toMatchObject({
        eod: 1,
        annual: 0,
        filings: 0,
        save: 0,
      });
      expect(fixture.portfolio?.getSnapshot()).toMatchObject({
        load: 1,
        save: 0,
        commits: 0,
      });
      prices.retire();
    } finally {
      workspace.sessionOwner.dispose();
    }
  });
});
