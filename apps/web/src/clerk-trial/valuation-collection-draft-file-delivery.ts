import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedValuationCollectionDraftFileDocument,
  type ManagedValuationCollectionDraftFileDocument,
} from "./managed-valuation-collection-draft-file";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface ManagedValuationCollectionDraftFileDeliveryAdapter {
  deliver(
    document: ManagedValuationCollectionDraftFileDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserValuationCollectionDraftFileAdapter: ManagedValuationCollectionDraftFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedValuationCollectionDraftFileDocument,
    "application/json;charset=utf-8",
    "Valuation collection file unavailable",
  );
export type InvestmentValuationCollectionDraftFilePlugin =
  NativeTextDocumentPlugin<{
    capturedAt: string;
  }>;
export function createNativeValuationCollectionDraftFileAdapter(
  plugin: InvestmentValuationCollectionDraftFilePlugin,
): ManagedValuationCollectionDraftFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedValuationCollectionDraftFileDocument,
    (document) => ({
      capturedAt: document.capturedAt,
    }),
    "Valuation collection file unavailable",
  );
}
