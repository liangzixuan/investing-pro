import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const VALUATION_PROOF_TARGET = Object.freeze({
  endpoint: "https://nyc.cloud.appwrite.io/v1",
  project: "6abac57a0007b7c1a671",
  databaseId: "investment_managed_valuation_v1",
  currentTableId: "assumptions",
  receiptsTableId: "receipts",
} as const);

type ColumnType = "varchar" | "bigint" | "mediumtext";
interface Column {
  readonly key: string;
  readonly type: ColumnType;
  readonly size?: number;
  readonly min?: number;
  readonly max?: number;
}
interface Table {
  readonly id: "assumptions" | "receipts";
  readonly name: string;
  readonly columns: readonly Column[];
}
const VERSION: Column = {
  key: "version",
  type: "bigint",
  min: 1,
  max: Number.MAX_SAFE_INTEGER,
};
const OWNER: Column = { key: "ownerId", type: "varchar", size: 36 };
const RESOURCE: Column = { key: "resourceId", type: "varchar", size: 4 };
const DIGEST: Column = { key: "digestSha256", type: "varchar", size: 64 };
const TABLES: readonly Table[] = [
  {
    id: "assumptions",
    name: "Valuation assumptions",
    columns: [
      OWNER,
      RESOURCE,
      VERSION,
      { key: "payloadJson", type: "mediumtext" },
      DIGEST,
      { key: "createdAt", type: "varchar", size: 24 },
      { key: "updatedAt", type: "varchar", size: 24 },
    ],
  },
  {
    id: "receipts",
    name: "Valuation assumption receipts",
    columns: [
      OWNER,
      RESOURCE,
      { key: "keyDigest", type: "varchar", size: 64 },
      { key: "requestDigest", type: "varchar", size: 64 },
      VERSION,
      DIGEST,
      { key: "committedAt", type: "varchar", size: 24 },
    ],
  },
];
const METADATA_LIMITS = Object.freeze({
  bytes: 65_536,
  depth: 8,
  nodes: 1024,
  arrayItems: 32,
  objectKeys: 32,
  stringCodeUnits: 4096,
});

export const VALUATION_PROOF_SCHEMA = freeze({
  version: 1 as const,
  target: VALUATION_PROOF_TARGET,
  database: {
    name: "Managed valuation assumptions",
    enabled: true,
    types: ["legacy", "tablesdb"],
  },
  tableSecurity: {
    enabled: true,
    rowSecurity: true,
    permissions: [],
    indexes: [],
  },
  columnPolicy: {
    required: true,
    array: false,
    default: null,
    encrypted: false,
    status: "available",
    error: "",
  },
  metadataLimits: METADATA_LIMITS,
  tables: TABLES,
});
export const VALUATION_PROOF_SCHEMA_SHA256 = sha256(
  canonical(VALUATION_PROOF_SCHEMA),
);

export interface ValuationProofSchemaFingerprint {
  readonly version: 1;
  readonly schemaSha256: string;
  readonly metadataSha256: string;
  readonly databaseId: typeof VALUATION_PROOF_TARGET.databaseId;
  readonly currentTableId: typeof VALUATION_PROOF_TARGET.currentTableId;
  readonly receiptsTableId: typeof VALUATION_PROOF_TARGET.receiptsTableId;
  readonly tableCount: 2;
  readonly columnCount: 14;
}
export interface ValuationProofCreateOperation {
  readonly ordinal: number;
  readonly method: "POST";
  readonly sdkMethod:
    | "create"
    | "createTable"
    | "createVarcharColumn"
    | "createBigIntColumn"
    | "createMediumtextColumn";
  readonly path: string;
  readonly params: Readonly<
    Record<string, string | number | boolean | readonly string[]>
  >;
}

type Operation = Omit<ValuationProofCreateOperation, "ordinal" | "method">;
const COLUMN_METHODS = {
  varchar: "createVarcharColumn",
  bigint: "createBigIntColumn",
  mediumtext: "createMediumtextColumn",
} as const;
function createColumn(table: Table, column: Column): Operation {
  const params: Record<string, string | number | boolean> = {
    databaseId: VALUATION_PROOF_TARGET.databaseId,
    tableId: table.id,
    key: column.key,
    required: true,
    array: false,
  };
  if (column.type === "bigint") {
    params.min = column.min!;
    params.max = column.max!;
  } else params.encrypt = false;
  if (column.type === "varchar") params.size = column.size!;
  return {
    sdkMethod: COLUMN_METHODS[column.type],
    path: `/v1/tablesdb/${VALUATION_PROOF_TARGET.databaseId}/tables/${table.id}/columns/${column.type}`,
    params,
  };
}
function createTable(table: Table): Operation {
  return {
    sdkMethod: "createTable",
    path: `/v1/tablesdb/${VALUATION_PROOF_TARGET.databaseId}/tables`,
    params: {
      databaseId: VALUATION_PROOF_TARGET.databaseId,
      tableId: table.id,
      name: table.name,
      permissions: [],
      rowSecurity: true,
      enabled: true,
    },
  };
}
const creates: Operation[] = [
  {
    sdkMethod: "create",
    path: "/v1/tablesdb",
    params: {
      databaseId: VALUATION_PROOF_TARGET.databaseId,
      name: VALUATION_PROOF_SCHEMA.database.name,
      enabled: true,
      specification: "serverless",
      replicas: 0,
    },
  },
  ...TABLES.map(createTable),
  ...TABLES.flatMap((table) =>
    table.columns.map((column) => createColumn(table, column)),
  ),
];
/** Descriptions only. Importing this module cannot create resources or construct an SDK. */
export const VALUATION_PROOF_CREATE_OPERATIONS: readonly ValuationProofCreateOperation[] =
  freeze(
    creates.map((operation, index) => ({
      ordinal: index + 1,
      method: "POST" as const,
      ...operation,
    })),
  );

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Data = Record<string, Json>;
interface Budget {
  bytes: number;
  nodes: number;
  active: Set<object>;
}
const DATABASE_FIELDS = [
  "$id",
  "name",
  "$createdAt",
  "$updatedAt",
  "enabled",
  "type",
  "status",
  "engine",
  "specification",
  "replicas",
  "error",
  "containerStatus",
  "lifecycleState",
  "policies",
  "archives",
];
const TABLE_FIELDS = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "$permissions",
  "databaseId",
  "name",
  "enabled",
  "rowSecurity",
  "columns",
  "indexes",
  "bytesMax",
  "bytesUsed",
];
const COLUMN_FIELDS = [
  "key",
  "type",
  "status",
  "error",
  "required",
  "array",
  "default",
  "$createdAt",
  "$updatedAt",
];
const COLUMN_EXTRA_FIELDS = {
  varchar: ["size", "encrypt"],
  bigint: ["min", "max"],
  mediumtext: ["encrypt"],
} as const;

/** Returns only fixed identities and digests. Provider metadata and backup contents never leave admission. */
export function inspectValuationProofSchema(
  database: unknown,
  tableList: unknown,
): ValuationProofSchemaFingerprint | null {
  try {
    const budget: Budget = { bytes: 0, nodes: 0, active: new Set() };
    const db = data(capture(database, budget, 0, true));
    const list = data(capture(tableList, budget, 0, true));
    assert.ok(
      Buffer.byteLength(canonical([db, list])) <= METADATA_LIMITS.bytes,
    );
    validateDatabase(db);
    knownKeys(list, ["total", "tables"]);
    assert.equal(list.total, 2);
    const tables = validateTables(list.tables);
    const admittedDatabase = Object.fromEntries(
      Object.entries(db).filter(
        ([key]) => !["policies", "archives"].includes(key),
      ),
    );
    return Object.freeze({
      version: 1,
      schemaSha256: VALUATION_PROOF_SCHEMA_SHA256,
      metadataSha256: sha256(canonical({ database: admittedDatabase, tables })),
      databaseId: VALUATION_PROOF_TARGET.databaseId,
      currentTableId: VALUATION_PROOF_TARGET.currentTableId,
      receiptsTableId: VALUATION_PROOF_TARGET.receiptsTableId,
      tableCount: 2,
      columnCount: 14,
    });
  } catch {
    return null;
  }
}
function validateDatabase(value: Data): void {
  knownKeys(value, DATABASE_FIELDS);
  assert.equal(value.$id, VALUATION_PROOF_TARGET.databaseId);
  assert.equal(value.name, VALUATION_PROOF_SCHEMA.database.name);
  assert.equal(value.enabled, true);
  assert.ok(
    VALUATION_PROOF_SCHEMA.database.types.includes(value.type as string),
  );
  metadataTimes(value);
  optional(value, "specification", [null, "serverless"]);
  optional(value, "replicas", [null, 0]);
  optional(value, "status", [null, "ready"]);
  optional(value, "error", [null, ""]);
  for (const key of ["engine", "containerStatus", "lifecycleState"])
    optional(value, key, [null]);
  for (const key of ["policies", "archives"]) optionalArray(value, key);
}
function validateTables(value: Json | undefined): Data[] {
  assert.ok(Array.isArray(value));
  assert.equal(value.length, 2);
  const tables = value.map(data);
  assert.equal(new Set(tables.map((table) => table.$id)).size, 2);
  return TABLES.map((expected) => {
    const table = tables.find((item) => item.$id === expected.id);
    assert.ok(table);
    return validateTable(table, expected);
  });
}
function validateTable(value: Data, expected: Table): Data {
  knownKeys(value, TABLE_FIELDS);
  assert.equal(value.$id, expected.id);
  assert.equal(value.databaseId, VALUATION_PROOF_TARGET.databaseId);
  assert.equal(value.name, expected.name);
  assert.equal(value.enabled, true);
  assert.equal(value.rowSecurity, true);
  emptyArray(value.$permissions);
  emptyArray(value.indexes);
  metadataTimes(value);
  nonnegativeInteger(value.bytesMax);
  nonnegativeInteger(value.bytesUsed);
  if (value.bytesMax !== 0) assert.ok(value.bytesUsed <= value.bytesMax);
  return { ...value, columns: validateColumns(value.columns, expected) };
}
function validateColumns(value: Json | undefined, expected: Table): Data[] {
  assert.ok(Array.isArray(value));
  assert.equal(value.length, 7);
  const columns = value.map(data);
  assert.equal(new Set(columns.map((column) => column.key)).size, 7);
  return expected.columns.map((definition) => {
    const column = columns.find((item) => item.key === definition.key);
    assert.ok(column);
    validateColumn(column, definition);
    return column;
  });
}
function validateColumn(value: Data, expected: Column): void {
  knownKeys(value, [...COLUMN_FIELDS, ...COLUMN_EXTRA_FIELDS[expected.type]]);
  assert.equal(value.key, expected.key);
  assert.equal(value.type, expected.type);
  assert.equal(value.required, true);
  assert.equal(value.status, "available");
  assert.equal(value.error, "");
  optional(value, "array", [false]);
  optional(value, "default", [null]);
  metadataTimes(value);
  if (expected.type === "bigint") {
    assert.equal(value.min, expected.min);
    assert.equal(value.max, expected.max);
    return;
  }
  optional(value, "encrypt", [false]);
  if (expected.type === "varchar") assert.equal(value.size, expected.size);
}
function knownKeys(value: Data, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) assert.ok(allowed.includes(key));
}
function optional(value: Data, key: string, allowed: readonly Json[]): void {
  if (!Object.hasOwn(value, key)) return;
  assert.ok(allowed.includes(value[key]!));
}
function optionalArray(value: Data, key: string): void {
  if (!Object.hasOwn(value, key)) return;
  if (value[key] === null) return;
  assert.ok(Array.isArray(value[key]));
}
function emptyArray(value: Json | undefined): void {
  assert.ok(Array.isArray(value));
  assert.equal(value.length, 0);
}
function nonnegativeInteger(value: unknown): asserts value is number {
  assert.equal(typeof value, "number");
  assert.ok(Number.isSafeInteger(value));
  assert.ok((value as number) >= 0);
}
function metadataTimes(value: Data): void {
  metadataTime(value.$createdAt);
  metadataTime(value.$updatedAt);
}
function metadataTime(value: Json | undefined): void {
  assert.equal(typeof value, "string");
  const matched =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value as string,
    );
  assert.ok(matched);
  const normalized = `${matched[1]}.${(matched[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`;
  assert.equal(new Date(normalized).toISOString(), normalized);
}

function data(value: Json): Data {
  assert.notEqual(value, null);
  assert.equal(typeof value, "object");
  assert.equal(Array.isArray(value), false);
  return value as Data;
}
function spend(budget: Budget, bytes: number): void {
  budget.bytes += bytes;
  budget.nodes++;
  assert.ok(budget.bytes <= METADATA_LIMITS.bytes);
  assert.ok(budget.nodes <= METADATA_LIMITS.nodes);
}
function capture(
  value: unknown,
  budget: Budget,
  depth: number,
  sdkRoot = false,
): Json {
  assert.ok(depth <= METADATA_LIMITS.depth);
  if (value === null) {
    spend(budget, 4);
    return null;
  }
  if (typeof value === "object")
    return captureObject(value, budget, depth, sdkRoot);
  if (typeof value === "string")
    assert.ok(value.length <= METADATA_LIMITS.stringCodeUnits);
  else if (typeof value === "number") assert.ok(Number.isFinite(value));
  else assert.equal(typeof value, "boolean");
  const json = JSON.stringify(value);
  spend(budget, Buffer.byteLength(json));
  return value as Json;
}
function captureObject(
  value: object,
  budget: Budget,
  depth: number,
  sdkRoot: boolean,
): Json {
  assert.equal(budget.active.has(value), false);
  budget.active.add(value);
  spend(budget, 2);
  try {
    if (Array.isArray(value)) return captureArray(value, budget, depth);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== null) assert.equal(prototype, Object.prototype);
    return captureProperties(value, budget, depth, sdkRoot);
  } finally {
    budget.active.delete(value);
  }
}
function captureArray(value: unknown[], budget: Budget, depth: number): Json[] {
  assert.equal(Object.getPrototypeOf(value), Array.prototype);
  assert.ok(value.length <= METADATA_LIMITS.arrayItems);
  assert.equal(Reflect.ownKeys(value).length, value.length + 1);
  return Array.from({ length: value.length }, (_, index) =>
    capture(
      propertyValue(Object.getOwnPropertyDescriptor(value, index)),
      budget,
      depth + 1,
    ),
  );
}
function propertyValue(descriptor: PropertyDescriptor | undefined): unknown {
  assert.ok(descriptor);
  assert.equal(descriptor.enumerable, true);
  assert.equal(Object.hasOwn(descriptor, "value"), true);
  return descriptor.value;
}
function captureProperties(
  value: object,
  budget: Budget,
  depth: number,
  sdkRoot: boolean,
): Data {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  assert.ok(keys.length <= METADATA_LIMITS.objectKeys);
  const entries: [string, Json][] = [];
  for (const key of keys) {
    assert.equal(typeof key, "string");
    assert.notEqual(key, "__proto__");
    assert.ok((key as string).length <= METADATA_LIMITS.stringCodeUnits);
    const descriptor = descriptors[key as string]!;
    if (sdkStringifier(key, descriptor, sdkRoot)) continue;
    spend(budget, Buffer.byteLength(JSON.stringify(key)) + 1);
    entries.push([
      key as string,
      capture(propertyValue(descriptor), budget, depth + 1),
    ]);
  }
  return Object.fromEntries(entries);
}
function sdkStringifier(
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  root: boolean,
): boolean {
  if (!root) return false;
  if (key !== "toString") return false;
  assert.equal(descriptor.enumerable, false);
  assert.equal(descriptor.writable, true);
  assert.equal(descriptor.configurable, true);
  assert.equal(typeof descriptor.value, "function");
  return true;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`)
    .join(",")}}`;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function freeze<T>(value: T): T {
  if (value === null) return value;
  if (typeof value !== "object") return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
