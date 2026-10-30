import { admitPortfolioReportArchiveJson } from "./portfolio-report-archive-admission";
import { extractPortfolioReportArchive } from "./portfolio-report-archive-html";
import {
  freezePortfolioReportData,
  portfolioReportWithinBounds,
} from "./portfolio-review-report-data";
import type { PreparedPortfolioReviewReport } from "./portfolio-review-report-types";
export { PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES } from "./portfolio-report-archive-html";

const archives = new WeakSet<object>();
export function isPortfolioReportArchive(
  value: unknown,
): value is PreparedPortfolioReviewReport {
  return typeof value === "object" && value !== null && archives.has(value);
}
/** An admitted private copy is not an authentic file or a current workspace capture. */
export function parsePortfolioReportArchive(
  bytes: ArrayBuffer,
): PreparedPortfolioReviewReport {
  try {
    const { json, filename } = extractPortfolioReportArchive(bytes);
    const report = admitPortfolioReportArchiveJson(json);
    if (
      filename !==
        `Investment-portfolio-review-${report.preparedAt.replace(/[-:.]/gu, "")}.html` ||
      !portfolioReportWithinBounds(report)
    )
      throw new TypeError("Portfolio archive filename or size differs.");
    freezePortfolioReportData(report);
    archives.add(report);
    return report;
  } catch {
    throw new TypeError(
      "Choose a complete, valid Portfolio review HTML report (up to 8 MiB).",
    );
  }
}
