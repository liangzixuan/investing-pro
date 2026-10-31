import { describe, expect, it, vi } from "vitest";
import { isPortfolioReportComparison } from "./portfolio-report-comparison";
import { isPreparedPortfolioReviewReport } from "./portfolio-review-report";
import { isPortfolioReportArchive } from "./portfolio-report-archive";
import {
  isPreparedPortfolioComparisonReport,
  preparePortfolioComparisonReport,
} from "./portfolio-comparison-report";
import {
  portfolioComparisonFixture,
  portfolioComparisonReportFixture,
} from "./portfolio-comparison-report-fixture";

describe("owned complete Portfolio comparison reading report", () => {
  it("retains both complete brands, raw values, original clocks and the full exact listing union", () => {
    const comparison = portfolioComparisonFixture();
    const report = preparePortfolioComparisonReport(
      comparison,
      "  Café 東京 📈 <private>.html  ",
      "2026-10-30T07:08:09.123Z",
    )!;
    expect(report.comparison).toBe(comparison);
    expect(report.savedFilename).toBe("  Café 東京 📈 <private>.html  ");
    expect(report.kind).toBe("portfolio_comparison");
    expect(isPreparedPortfolioComparisonReport(report)).toBe(true);
    expect(isPortfolioReportComparison(comparison)).toBe(true);
    expect(isPortfolioReportArchive(comparison.saved)).toBe(true);
    expect(isPreparedPortfolioReviewReport(comparison.saved)).toBe(false);
    expect(isPreparedPortfolioReviewReport(comparison.current)).toBe(true);
    expect(comparison.rows.map((r) => [r.listingId, r.status])).toEqual([
      ["invented-shared", "both"],
      ["invented-saved", "saved-only"],
      ["invented-conflict", "identity-conflict"],
      ["invented-goog", "both"],
      ["invented-googl", "both"],
      ["invented-current", "current-only"],
    ]);
    expect(comparison.saved.preparedAt).toBe("2026-10-28T01:02:03.004Z");
    expect(comparison.current.preparedAt).toBe("2026-10-29T04:05:06.007Z");
    expect(comparison.saved.review.cashUsd).toBeNull();
    expect(comparison.current.ledger.opening.cashUsd).toBe("123.45");
    expect(comparison.saved.sourceRows[0]!.showingPrevious).toBe(true);
    expect(comparison.rows[4]!.saved!.line.close).toBeNull();
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(comparison.rows[0])).toBe(true);
  });
  it("rejects clones, forged rows and hostile objects without inspecting their contents", () => {
    const report = portfolioComparisonReportFixture(),
      trap = vi.fn(() => {
        throw Error("must not inspect");
      });
    const hostile = new Proxy({}, { get: trap, ownKeys: trap });
    for (const value of [{ ...report.comparison }, hostile]) {
      expect(isPortfolioReportComparison(value)).toBe(false);
      expect(
        preparePortfolioComparisonReport(
          value as never,
          "saved.html",
          report.preparedAt,
        ),
      ).toBeNull();
    }
    expect(isPreparedPortfolioComparisonReport({ ...report })).toBe(false);
    expect(isPreparedPortfolioComparisonReport(hostile)).toBe(false);
    expect(trap).not.toHaveBeenCalled();
  });
  it.each([
    "2026-02-30T00:00:00.000Z",
    "2026-10-30",
    "2026-10-30T07:08:09Z",
    "2026-10-30T07:08:09.000+00:00",
    "not a date",
  ])("rejects noncanonical capture time %s", (date) => {
    expect(
      preparePortfolioComparisonReport(
        portfolioComparisonFixture(),
        "saved.html",
        date,
      ),
    ).toBeNull();
  });
  it("refuses invalid Unicode, absent names and oversized complete data without clipping", () => {
    const comparison = portfolioComparisonFixture();
    for (const name of ["", "bad\ud800.html", "é".repeat(4 * 1024 * 1024)])
      expect(
        preparePortfolioComparisonReport(
          comparison,
          name,
          "2026-10-30T07:08:09.123Z",
        ),
      ).toBeNull();
    expect(comparison.rows).toHaveLength(6);
  });
});
