import {
  isPortfolioReportComparison,
  type PortfolioReportComparison,
} from "./portfolio-report-comparison";
import { portfolioReportWithinBounds } from "./portfolio-review-report-data";

export interface PreparedPortfolioComparisonReport {
  readonly kind: "portfolio_comparison";
  readonly preparedAt: string;
  readonly savedFilename: string;
  readonly comparison: PortfolioReportComparison;
}
const owned = new WeakSet<object>();
export function isPreparedPortfolioComparisonReport(
  value: unknown,
): value is PreparedPortfolioComparisonReport {
  return typeof value === "object" && value !== null && owned.has(value);
}
/** Own a complete immutable reading copy; preserve both original evidence brands and clocks. */
export function preparePortfolioComparisonReport(
  comparison: PortfolioReportComparison,
  savedFilename: string,
  preparedAt: string,
): PreparedPortfolioComparisonReport | null {
  if (!isPortfolioReportComparison(comparison)) return null;
  if (typeof savedFilename !== "string" || !savedFilename.length) return null;
  if (
    typeof preparedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(preparedAt)
  )
    return null;
  try {
    if (new Date(preparedAt).toISOString() !== preparedAt) return null;
    const report: PreparedPortfolioComparisonReport = {
      kind: "portfolio_comparison",
      preparedAt,
      savedFilename,
      comparison,
    };
    if (!portfolioReportWithinBounds(report)) return null;
    Object.freeze(report);
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
