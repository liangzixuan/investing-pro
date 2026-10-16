import type { CompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportHtmlDocument } from "./managed-company-report-html";
import type { PreparedCompanyReport } from "./managed-company-report";
import type { BrowserTextDownloadResult } from "./browser-text-download";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
interface JsonReportDelivery {
  deliver(
    document: CompanyReportDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}

export type CompanyReportDeliveryAdapter = JsonReportDelivery &
  (
    | {
        readonly destination: "browser_download";
        readonly html?: {
          format(
            report: PreparedCompanyReport,
          ): CompanyReportHtmlDocument | null;
          deliver(
            document: CompanyReportHtmlDocument,
            context: TextDocumentDeliveryContext,
          ): Promise<BrowserTextDownloadResult>;
        };
      }
    | { readonly destination: "system_document" }
  );
