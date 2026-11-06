import type { ScreenPassReviewReportDeliveryAdapter } from "./screen-pass-review-report-ports";
import { isScreenPassReviewReportHtmlDocument } from "./screen-pass-review-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserScreenPassReviewReportAdapter: ScreenPassReviewReportDeliveryAdapter =
  {
    ...createBrowserTextDownload(
      isScreenPassReviewReportHtmlDocument,
      "text/html;charset=utf-8",
      "Annual-pass report save unavailable",
    ),
    actionLabel: "Download Annual-pass report (HTML)",
  };
export type InvestmentScreenPassReviewReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.screen-pass-review-html";
  filename: string;
}>;
export function createNativeScreenPassReviewReportAdapter(
  plugin: InvestmentScreenPassReviewReportPlugin,
): ScreenPassReviewReportDeliveryAdapter {
  return {
    ...createNativeTextDocumentDelivery(
      plugin,
      isScreenPassReviewReportHtmlDocument,
      (document) => ({
        purpose: "investment.screen-pass-review-html" as const,
        filename: document.filename,
      }),
      "Annual-pass report save unavailable",
    ),
    actionLabel: "Save Annual-pass report (HTML)",
  };
}
