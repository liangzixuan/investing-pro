import { createBrowserTextDownload } from "./browser-text-download";
import { isCompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";

export const browserCompanyReportAdapter: CompanyReportDeliveryAdapter = {
  destination: "browser_download",
  ...createBrowserTextDownload(
    isCompanyReportDocument,
    "application/json;charset=utf-8",
    "Report download unavailable",
  ),
};
