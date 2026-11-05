import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface DueCheckEvidenceReportHtmlDocument {
  readonly purpose: "investment.due-check-evidence-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}
export interface DueCheckEvidenceReportDeliveryAdapter {
  readonly actionLabel?: string;
  deliver(
    document: DueCheckEvidenceReportHtmlDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
