import { TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import { createAppwriteValuationAssumptionsRepository } from "./appwrite-valuation-assumptions-repository";
import { createManagedValuationAssumptionsCatalog } from "./managed-workspace-catalog";
import type { ManagedValuationAssumptionsRepositoryOperation } from "./managed-workspace-handler";

/** Fixed server composition; the captured execution key never comes from a saved body. */
export async function openManagedValuationAssumptionsStorage(
  signal: AbortSignal,
  executionKey: string | undefined,
): Promise<ManagedValuationAssumptionsRepositoryOperation> {
  if (!executionKey) throw new Error("Execution authority unavailable");
  const transport = createAppwriteTransport({
    endpoint: "https://nyc.cloud.appwrite.io/v1",
    signal,
  });
  try {
    transport.client.setProject("6abac57a0007b7c1a671").setKey(executionKey);
    return {
      repository: createAppwriteValuationAssumptionsRepository({
        store: appwriteVersionedRowStore(new TablesDB(transport.client)),
        databaseId: "investment_managed_valuation_v1",
        assumptionsTableId: "assumptions",
        receiptsTableId: "receipts",
        catalog: createManagedValuationAssumptionsCatalog(),
      }),
      close: () => transport.close(),
    };
  } catch {
    await transport.close();
    throw new Error("Managed valuation assumptions storage unavailable");
  }
}
