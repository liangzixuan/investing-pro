import type { ScreenResearchReportDeliveryAdapter } from "./screen-research-report-ports";
import { isScreenResearchReportHtmlDocument } from "./screen-research-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserScreenResearchReportAdapter: ScreenResearchReportDeliveryAdapter =
  {
    ...createBrowserTextDownload(
      isScreenResearchReportHtmlDocument,
      "text/html;charset=utf-8",
      "Paired research report save unavailable",
    ),
    actionLabel: "Download paired research (HTML)",
  };
export type InvestmentScreenResearchReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.screen-research-html";
  filename: string;
}>;
export function createNativeScreenResearchReportAdapter(
  plugin: InvestmentScreenResearchReportPlugin,
): ScreenResearchReportDeliveryAdapter {
  return {
    ...createNativeTextDocumentDelivery(
      plugin,
      isScreenResearchReportHtmlDocument,
      (document) => ({
        purpose: "investment.screen-research-html" as const,
        filename: document.filename,
      }),
      "Paired research report save unavailable",
    ),
    actionLabel: "Save paired research (HTML)",
  };
}
