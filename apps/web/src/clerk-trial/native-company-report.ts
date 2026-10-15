import { isCompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";
export type InvestmentCompanyReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.company-research";
  filename: string;
}>;
export function createNativeCompanyReportAdapter(
  plugin: InvestmentCompanyReportPlugin,
): CompanyReportDeliveryAdapter {
  return {
    destination: "system_document",
    ...createNativeTextDocumentDelivery(
      plugin,
      isCompanyReportDocument,
      (document) => ({
        purpose: document.purpose,
        filename: document.filename,
      }),
      "Report save unavailable",
    ),
  };
}
