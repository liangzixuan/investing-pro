import { isCompanyReportDocument } from "./managed-company-report-document";
import {
  formatCompanyReportHtml,
  isCompanyReportHtmlDocument,
} from "./managed-company-report-html";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { TextDocumentDeliveryContext } from "./document-delivery";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
  type NativeDocumentDeliveryResult,
} from "./native-text-document-delivery";

export type InvestmentCompanyReportPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.company-research";
  filename: string;
}>;
export type InvestmentCompanyReportHtmlPlugin = NativeTextDocumentPlugin<{
  purpose: "investment.company-research-html";
  filename: string;
}>;

export function createNativeCompanyReportAdapter(
  plugin: InvestmentCompanyReportPlugin,
  htmlPlugin: InvestmentCompanyReportHtmlPlugin,
): CompanyReportDeliveryAdapter {
  // Both formats share one operation owner, including direct adapter callers.
  let pending = false;
  function exclusive<T>(delivery: {
    deliver(
      document: T,
      context: TextDocumentDeliveryContext,
    ): Promise<NativeDocumentDeliveryResult>;
  }) {
    return async (document: T, context: TextDocumentDeliveryContext) => {
      if (pending) throw new Error("Report save unavailable");
      pending = true;
      try {
        return await delivery.deliver(document, context);
      } finally {
        pending = false;
      }
    };
  }
  const json = createNativeTextDocumentDelivery(
    plugin,
    isCompanyReportDocument,
    (document) => ({ purpose: document.purpose, filename: document.filename }),
    "Report save unavailable",
  );
  const html = createNativeTextDocumentDelivery(
    htmlPlugin,
    isCompanyReportHtmlDocument,
    (document) => ({ purpose: document.purpose, filename: document.filename }),
    "Report save unavailable",
  );
  return {
    destination: "system_document",
    deliver: exclusive(json),
    html: { format: formatCompanyReportHtml, deliver: exclusive(html) },
  };
}
