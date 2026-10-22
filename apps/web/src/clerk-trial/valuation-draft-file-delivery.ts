import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedValuationDraftFileDocument,
  type ManagedValuationDraftFileDocument,
} from "./managed-valuation-draft-file";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface ManagedValuationDraftFileDeliveryAdapter {
  deliver(
    document: ManagedValuationDraftFileDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserValuationDraftFileAdapter: ManagedValuationDraftFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedValuationDraftFileDocument,
    "application/json;charset=utf-8",
    "Valuation inputs file unavailable",
  );
export type InvestmentValuationDraftFilePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
}>;
export function createNativeValuationDraftFileAdapter(
  plugin: InvestmentValuationDraftFilePlugin,
): ManagedValuationDraftFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedValuationDraftFileDocument,
    (document) => ({
      capturedAt: document.capturedAt,
    }),
    "Valuation inputs file unavailable",
  );
}
