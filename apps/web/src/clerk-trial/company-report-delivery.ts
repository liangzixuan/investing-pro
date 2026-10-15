import type { CompanyReportDocument } from "./managed-company-report-document";
import type {
  BrowserTextDownloadContext,
  BrowserTextDownloadResult,
} from "./browser-text-download";

export interface CompanyReportDeliveryAdapter {
  deliver(
    document: CompanyReportDocument,
    context: BrowserTextDownloadContext,
  ): Promise<BrowserTextDownloadResult>;
}
