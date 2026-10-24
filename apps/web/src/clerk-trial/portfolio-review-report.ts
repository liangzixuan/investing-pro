import { admitPortfolioReviewReport } from "./portfolio-review-report-admission";
import {
  freezePortfolioReportData,
  portfolioReportWithinBounds,
} from "./portfolio-review-report-data";
import type {
  PortfolioReviewReportInput,
  PreparedPortfolioReviewReport,
} from "./portfolio-review-report-types";
export type { PreparedPortfolioReviewReport } from "./portfolio-review-report-types";

const owned = new WeakSet<object>();
export function isPreparedPortfolioReviewReport(
  value: unknown,
): value is PreparedPortfolioReviewReport {
  return typeof value === "object" && value !== null && owned.has(value);
}
/** Copies one completed, internally consistent review. No request or save occurs. */
export function preparePortfolioReviewReport(
  input: PortfolioReviewReportInput,
): PreparedPortfolioReviewReport | null {
  try {
    const report = admitPortfolioReviewReport(input);
    if (!portfolioReportWithinBounds(report)) return null;
    freezePortfolioReportData(report);
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
