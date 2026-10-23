import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isManagedFinancialScreenRecipeDocument,
  type ManagedFinancialScreenRecipeDocument,
} from "./managed-financial-screen-recipe";
import { createBrowserTextDownload } from "./browser-text-download";
import {
  createNativeTextDocumentDelivery,
  type NativeTextDocumentPlugin,
} from "./native-text-document-delivery";

export interface ManagedFinancialScreenRecipeDeliveryAdapter {
  deliver(
    document: ManagedFinancialScreenRecipeDocument,
    context: TextDocumentDeliveryContext,
  ): Promise<TextDocumentDeliveryResult>;
}

export const browserFinancialScreenRecipeAdapter: ManagedFinancialScreenRecipeDeliveryAdapter =
  createBrowserTextDownload(
    isManagedFinancialScreenRecipeDocument,
    "application/json;charset=utf-8",
    "Screen recipe file unavailable",
  );

export type InvestmentFinancialScreenRecipePlugin = NativeTextDocumentPlugin<{
  capturedAt: string;
}>;

export function createNativeFinancialScreenRecipeAdapter(
  plugin: InvestmentFinancialScreenRecipePlugin,
): ManagedFinancialScreenRecipeDeliveryAdapter {
  return createNativeTextDocumentDelivery(
    plugin,
    isManagedFinancialScreenRecipeDocument,
    (document) => ({ capturedAt: document.capturedAt }),
    "Screen recipe file unavailable",
  );
}
