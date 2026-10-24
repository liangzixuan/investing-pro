import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isPortfolioReviewReportHtmlDocument,
  type PortfolioReviewReportHtmlDocument,
} from "./portfolio-review-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface PortfolioReviewReportDeliveryAdapter {
  deliver(
    document: PortfolioReviewReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserPortfolioReviewReportAdapter: PortfolioReviewReportDeliveryAdapter =
  createBrowserTextDownload(
    isPortfolioReviewReportHtmlDocument,
    "text/html;charset=utf-8",
    "Portfolio report save unavailable",
  );
export type InvestmentPortfolioReviewReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.portfolio-review-html";
  filename: string;
}>;
export function createNativePortfolioReviewReportAdapter(
  plugin: InvestmentPortfolioReviewReportPlugin,
): PortfolioReviewReportDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isPortfolioReviewReportHtmlDocument,
    (document) => ({
      purpose: "investment.portfolio-review-html" as const,
      filename: document.filename,
    }),
    "Portfolio report save unavailable",
  );
}
