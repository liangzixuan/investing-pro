import type { WatchlistDailyReportDeliveryAdapter } from "./watchlist-daily-report-ports";
import { isWatchlistDailyReportHtmlDocument } from "./watchlist-daily-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserWatchlistDailyReportAdapter: WatchlistDailyReportDeliveryAdapter =
  {
    ...createBrowserTextDownload(
      isWatchlistDailyReportHtmlDocument,
      "text/html;charset=utf-8",
      "Daily review report save unavailable",
    ),
    actionLabel: "Download daily review (HTML)",
  };
export type InvestmentWatchlistDailyReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.watchlist-daily-html";
  filename: string;
}>;
export function createNativeWatchlistDailyReportAdapter(
  plugin: InvestmentWatchlistDailyReportPlugin,
): WatchlistDailyReportDeliveryAdapter {
  return {
    ...createNativeTextDocumentDelivery(
      plugin,
      isWatchlistDailyReportHtmlDocument,
      (document) => ({
        purpose: "investment.watchlist-daily-html" as const,
        filename: document.filename,
      }),
      "Daily review report save unavailable",
    ),
    actionLabel: "Save daily review (HTML)",
  };
}
