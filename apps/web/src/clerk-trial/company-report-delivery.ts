import type { CompanyReportDocument } from "./managed-company-report-document";
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
}
