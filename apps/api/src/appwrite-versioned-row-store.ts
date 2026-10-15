import type { TablesDB } from "node-appwrite";

export interface AppwriteRowLocation {
  readonly databaseId: string;
  readonly tableId: string;
  readonly rowId: string;
}
type RowData = Readonly<Record<string, string | number>>;

/** Object-parameter subset of TablesDB 29, also used by the atomic test model. */
export interface AppwriteVersionedRowStore {
  getRow(input: AppwriteRowLocation): Promise<unknown>;
  createTransaction(input: { ttl: number }): Promise<unknown>;
  createRow(
    input: AppwriteRowLocation & {
      data: RowData;
      permissions: string[];
      transactionId: string;
    },
  ): Promise<unknown>;
  updateRow(
    input: AppwriteRowLocation & { data: RowData; transactionId: string },
  ): Promise<unknown>;
  incrementRowColumn(
    input: AppwriteRowLocation & {
      column: "version";
      value: 1;
      max: number;
      transactionId: string;
    },
  ): Promise<unknown>;
  updateTransaction(input: {
    transactionId: string;
    commit?: boolean;
    rollback?: boolean;
  }): Promise<unknown>;
}

/** Client construction, credentials and transport lifetime belong to the server. */
export function appwriteVersionedRowStore(
  tables: TablesDB,
): AppwriteVersionedRowStore {
  return {
    getRow: (input) => tables.getRow(input),
    createTransaction: (input) => tables.createTransaction(input),
    createRow: (input) => tables.createRow(input),
    updateRow: (input) => tables.updateRow(input),
    incrementRowColumn: (input) => tables.incrementRowColumn(input),
    updateTransaction: (input) => tables.updateTransaction(input),
  };
}
