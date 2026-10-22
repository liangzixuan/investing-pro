import type { CompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportHtmlDocument } from "./managed-company-report-html";
import type { PreparedCompanyReport } from "./managed-company-report";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface CompanyReportDeliveryAdapter {
  readonly destination: "browser_download" | "system_document";
  deliver(
    document: CompanyReportDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
  readonly html?: {
    format(report: PreparedCompanyReport): CompanyReportHtmlDocument | null;
    deliver(
      document: CompanyReportHtmlDocument,
      context: TextDocumentDeliveryContext,
    ): Promise<TextDocumentDeliveryResult>;
  };
}
