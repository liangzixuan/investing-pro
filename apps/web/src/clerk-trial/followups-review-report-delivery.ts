import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import { isFollowupsReviewReportHtmlDocument } from "./followups-review-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserFollowupsReviewReportAdapter: FollowupsReviewReportDeliveryAdapter =
  createBrowserTextDownload(
    isFollowupsReviewReportHtmlDocument,
    "text/html;charset=utf-8",
    "Follow-ups report save unavailable",
  );
export type InvestmentFollowupsReviewReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.followups-review-html";
  filename: string;
}>;
export function createNativeFollowupsReviewReportAdapter(
  plugin: InvestmentFollowupsReviewReportPlugin,
): FollowupsReviewReportDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isFollowupsReviewReportHtmlDocument,
    (document) => ({
      purpose: "investment.followups-review-html" as const,
      filename: document.filename,
    }),
    "Follow-ups report save unavailable",
  );
}
