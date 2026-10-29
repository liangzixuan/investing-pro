import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import { isScreenComparisonReportHtmlDocument } from "./screen-comparison-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserScreenComparisonReportAdapter: ScreenComparisonReportDeliveryAdapter =
  createBrowserTextDownload(
    isScreenComparisonReportHtmlDocument,
    "text/html;charset=utf-8",
    "Comparison report save unavailable",
  );
export type InvestmentScreenComparisonReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.screen-comparison-html";
  filename: string;
}>;
export function createNativeScreenComparisonReportAdapter(
  plugin: InvestmentScreenComparisonReportPlugin,
): ScreenComparisonReportDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isScreenComparisonReportHtmlDocument,
    (document) => ({
      purpose: "investment.screen-comparison-html" as const,
      filename: document.filename,
    }),
    "Comparison report save unavailable",
  );
}
