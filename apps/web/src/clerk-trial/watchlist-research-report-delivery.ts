import type { WatchlistResearchReportDeliveryAdapter } from "./watchlist-research-report-ports";
import { isWatchlistResearchReportHtmlDocument } from "./watchlist-research-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserWatchlistResearchReportAdapter: WatchlistResearchReportDeliveryAdapter =
  {
    ...createBrowserTextDownload(
      isWatchlistResearchReportHtmlDocument,
      "text/html;charset=utf-8",
      "Watchlist research report save unavailable",
    ),
    actionLabel: "Download Watchlist research (HTML)",
  };
export type InvestmentWatchlistResearchReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.watchlist-research-html";
  filename: string;
}>;
export function createNativeWatchlistResearchReportAdapter(
  plugin: InvestmentWatchlistResearchReportPlugin,
): WatchlistResearchReportDeliveryAdapter {
  return {
    ...createNativeTextDocumentDelivery(
      plugin,
      isWatchlistResearchReportHtmlDocument,
      (document) => ({
        purpose: "investment.watchlist-research-html" as const,
        filename: document.filename,
      }),
      "Watchlist research report save unavailable",
    ),
    actionLabel: "Save Watchlist research (HTML)",
  };
}
