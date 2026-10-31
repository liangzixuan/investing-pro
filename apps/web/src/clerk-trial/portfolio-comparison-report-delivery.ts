import type { PortfolioComparisonReportDeliveryAdapter } from "./portfolio-comparison-report-ports";
import { isPortfolioComparisonReportHtmlDocument } from "./portfolio-comparison-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserPortfolioComparisonReportAdapter: PortfolioComparisonReportDeliveryAdapter =
  createBrowserTextDownload(
    isPortfolioComparisonReportHtmlDocument,
    "text/html;charset=utf-8",
    "Comparison report save unavailable",
  );
export type InvestmentPortfolioComparisonReportPlugin =
  NativeTextDocumentPlugin<{
    purpose: "investment.portfolio-comparison-html";
    filename: string;
  }>;
export function createNativePortfolioComparisonReportAdapter(
  plugin: InvestmentPortfolioComparisonReportPlugin,
): PortfolioComparisonReportDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isPortfolioComparisonReportHtmlDocument,
    (document) => ({
      purpose: "investment.portfolio-comparison-html" as const,
      filename: document.filename,
    }),
    "Comparison report save unavailable",
  );
}
