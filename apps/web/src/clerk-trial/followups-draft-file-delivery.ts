import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedFollowupsDraftFileDocument,
  type ManagedFollowupsDraftFileDocument,
} from "./managed-followups-draft-file";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface ManagedFollowupsDraftFileDeliveryAdapter {
  deliver(
    document: ManagedFollowupsDraftFileDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserFollowupsDraftFileAdapter: ManagedFollowupsDraftFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedFollowupsDraftFileDocument,
    "application/json;charset=utf-8",
    "Follow-ups draft file unavailable",
  );
export type InvestmentFollowupsDraftFilePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
  baseVersion: number;
}>;
export function createNativeFollowupsDraftFileAdapter(
  plugin: InvestmentFollowupsDraftFilePlugin,
): ManagedFollowupsDraftFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedFollowupsDraftFileDocument,
    (document) => ({
      capturedAt: document.capturedAt,
      baseVersion: document.baseVersion,
    }),
    "Follow-ups draft file unavailable",
  );
}
