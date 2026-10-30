import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedResearchDraftSetFileDocument,
  type ManagedResearchDraftSetFileDocument,
} from "./managed-research-draft-set-file";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";
export interface ManagedResearchDraftSetFileDeliveryAdapter {
  deliver(
    document: ManagedResearchDraftSetFileDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserResearchDraftSetFileAdapter: ManagedResearchDraftSetFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedResearchDraftSetFileDocument,
    "application/json;charset=utf-8",
    "Research draft-set file unavailable",
  );
export type InvestmentResearchDraftSetFilePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
}>;
export function createNativeResearchDraftSetFileAdapter(
  plugin: InvestmentResearchDraftSetFilePlugin,
): ManagedResearchDraftSetFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedResearchDraftSetFileDocument,
    (document) => ({ capturedAt: document.capturedAt }),
    "Research draft-set file unavailable",
  );
}
