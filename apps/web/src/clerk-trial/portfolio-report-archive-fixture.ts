import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import { portfolioReviewReportFixture } from "./portfolio-review-report-fixture";
import type { PreparedPortfolioReviewReport } from "./portfolio-review-report-types";

export const archiveBytes = (text: string): ArrayBuffer =>
  new TextEncoder().encode(text).buffer;
export const escapeArchiveText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function archiveReportFixture() {
  const report = preparePortfolioReviewReport(portfolioReviewReportFixture());
  if (!report) throw new Error("Invalid invented report");
  return report;
}
/** Actual snapshot renderer and format-1 head; no browser or real private file. */
export function archiveHtmlFixture(
  report: PreparedPortfolioReviewReport = archiveReportFixture(),
) {
  const filename = `Investment-portfolio-review-${report.preparedAt.replace(/[-:.]/gu, "")}.html`;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeArchiveText(COMPANY_REPORT_HTML_CSP)}"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="investment-report-format" content="1"><meta name="investment-report-purpose" content="investment.portfolio-review-html"><meta name="investment-report-filename" content="${filename}"><title>Portfolio holdings review</title><style>${COMPANY_REPORT_HTML_STYLE}</style></head><body><main>${renderToStaticMarkup(createElement(PortfolioReviewReportSnapshot, { report }))}</main></body></html>\n`;
}
export function archiveWithJson(
  value: unknown,
  report = archiveReportFixture(),
) {
  return archiveHtmlFixture(report).replace(
    /<pre>[\s\S]*?<\/pre>/u,
    `<pre>${escapeArchiveText(typeof value === "string" ? value : JSON.stringify(value))}</pre>`,
  );
}
