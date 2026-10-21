import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedPortfolioDraftFileDocument,
  type ManagedPortfolioDraftFileDocument,
} from "./managed-portfolio-draft-file";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface ManagedPortfolioDraftFileDeliveryAdapter {
  deliver(
    document: ManagedPortfolioDraftFileDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}
export const browserPortfolioDraftFileAdapter: ManagedPortfolioDraftFileDeliveryAdapter =
  createBrowserTextDownload(
    isManagedPortfolioDraftFileDocument,
    "application/json;charset=utf-8",
    "Portfolio draft file unavailable",
  );
export type InvestmentPortfolioDraftFilePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
  baseVersion: number;
}>;
export function createNativePortfolioDraftFileAdapter(
  plugin: InvestmentPortfolioDraftFilePlugin,
): ManagedPortfolioDraftFileDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedPortfolioDraftFileDocument,
    (document) => ({
      capturedAt: document.capturedAt,
      baseVersion: document.baseVersion,
    }),
    "Portfolio draft file unavailable",
  );
}
