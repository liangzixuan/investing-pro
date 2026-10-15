export interface TextDocumentDeliveryContext {
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}
export type TextDocumentDeliveryResult =
  "download_requested" | "written" | "cancelled";
