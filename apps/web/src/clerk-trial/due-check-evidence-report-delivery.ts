import type { DueCheckEvidenceReportDeliveryAdapter } from "./due-check-evidence-report-ports";
import { isDueCheckEvidenceReportHtmlDocument } from "./due-check-evidence-report-html";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export const browserDueCheckEvidenceReportAdapter: DueCheckEvidenceReportDeliveryAdapter =
  {
    ...createBrowserTextDownload(
      isDueCheckEvidenceReportHtmlDocument,
      "text/html;charset=utf-8",
      "Due-check evidence report save unavailable",
    ),
    actionLabel: "Download due-check evidence (HTML)",
  };
export type InvestmentDueCheckEvidenceReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.due-check-evidence-html";
  filename: string;
}>;
export function createNativeDueCheckEvidenceReportAdapter(
  plugin: InvestmentDueCheckEvidenceReportPlugin,
): DueCheckEvidenceReportDeliveryAdapter {
  return {
    ...createNativeTextDocumentDelivery(
      plugin,
      isDueCheckEvidenceReportHtmlDocument,
      (document) => ({
        purpose: "investment.due-check-evidence-html" as const,
        filename: document.filename,
      }),
      "Due-check evidence report save unavailable",
    ),
    actionLabel: "Save due-check evidence (HTML)",
  };
}
