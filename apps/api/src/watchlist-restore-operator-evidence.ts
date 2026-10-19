import {
  WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
  WATCHLIST_RESTORE_PROOF_PRINCIPAL,
  WATCHLIST_RESTORE_PROOF_TIMES,
  watchlistRestoreProofHash,
  watchlistRestoreProofLocation,
  type WatchlistRestoreProofSide,
} from "./watchlist-restore-proof-data";

type Side = WatchlistRestoreProofSide;
type Stage = "empty" | "baseline" | "final";
type Availability = "pending" | "available";
type RecordValue = Record<string, unknown>;
type TableId = "watchlists" | "receipts";
type Version = 1 | 2 | 3;
interface Column {
  readonly key: string;
  readonly type: "varchar" | "bigint" | "mediumtext";
  readonly size?: number;
}
export interface RowFingerprint {
  readonly side: Side;
  readonly rowId: string;
  readonly sha256: string;
  readonly applicationSha256: string;
}
interface SchemaInput {
  readonly side: Side;
  readonly database: unknown;
  readonly tables?: unknown;
  readonly watchlists: unknown;
  readonly receipts: unknown;
}
interface RowsInput {
  readonly side: Side;
  readonly stage: Stage;
  readonly watchlists: unknown;
  readonly receipts: unknown;
}

export class WatchlistRestoreEvidenceError extends Error {
  constructor() {
    super("Watchlist restore evidence refused.");
  }
}

const OWNER: Column = { key: "ownerId", type: "varchar", size: 36 };
const WATCHLIST: Column = { key: "watchlistId", type: "varchar", size: 4 };
const VERSION: Column = { key: "version", type: "bigint" };
const DIGEST: Column = { key: "digestSha256", type: "varchar", size: 64 };
const COLUMNS: Record<TableId, readonly Column[]> = {
  watchlists: [
    OWNER,
    WATCHLIST,
    VERSION,
    { key: "payloadJson", type: "mediumtext" },
    DIGEST,
    { key: "createdAt", type: "varchar", size: 24 },
    { key: "updatedAt", type: "varchar", size: 24 },
  ],
  receipts: [
    OWNER,
    WATCHLIST,
    { key: "keyDigest", type: "varchar", size: 64 },
    { key: "requestDigest", type: "varchar", size: 64 },
    VERSION,
    DIGEST,
    { key: "committedAt", type: "varchar", size: 24 },
  ],
};
const TABLE_NAMES: Record<TableId, string> = {
  watchlists: "Watchlist qualification",
  receipts: "Watchlist qualification receipts",
};
const PLATFORM_FIELDS = [
  "$id",
  "$sequence",
  "$tableId",
  "$databaseId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
] as const;
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
] as const;

function requireEvidence(value: unknown): asserts value {
  if (!value) throw new WatchlistRestoreEvidenceError();
}
function guarded<T>(action: () => T): T {
  try {
    return action();
  } catch {
    throw new WatchlistRestoreEvidenceError();
  }
}
function sdkStringifier(descriptor: PropertyDescriptor): boolean {
  if (descriptor.enumerable !== false) return false;
  if (descriptor.configurable !== true) return false;
  if (descriptor.writable !== true) return false;
  return typeof descriptor.value === "function";
}
function dataValue(descriptor: PropertyDescriptor): unknown {
  requireEvidence("value" in descriptor);
  requireEvidence(descriptor.enumerable);
  return descriptor.value;
}
/** Read JSON data fields without invoking accessors or the SDK's stringifier. */
function object(value: unknown): RecordValue {
  requireEvidence(value !== null && typeof value === "object");
  requireEvidence(!Array.isArray(value));
  const prototype: unknown = Object.getPrototypeOf(value);
  requireEvidence(prototype === Object.prototype || prototype === null);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  requireEvidence(keys.length <= 33);
  const result: RecordValue = {};
  for (const key of keys) {
    requireEvidence(typeof key === "string");
    requireEvidence(key !== "__proto__");
    const descriptor = descriptors[key]!;
    if (key === "toString" && sdkStringifier(descriptor)) continue;
    result[key] = dataValue(descriptor);
  }
  return result;
}
function array(value: unknown, maximum: number): unknown[] {
  requireEvidence(Array.isArray(value));
  requireEvidence(value.length <= maximum);
  requireEvidence(Reflect.ownKeys(value).length === value.length + 1);
  return Array.from({ length: value.length }, (_unused, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    requireEvidence(descriptor);
    return dataValue(descriptor);
  });
}
function exactKeys(value: RecordValue, names: readonly string[]): void {
  requireEvidence(
    Object.keys(value).sort().join(",") === [...names].sort().join(","),
  );
}
function knownKeys(value: RecordValue, names: readonly string[]): void {
  requireEvidence(Object.keys(value).every((name) => names.includes(name)));
}
function metadataTime(value: unknown): void {
  requireEvidence(typeof value === "string");
  requireEvidence(value.length <= 35);
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  requireEvidence(match);
  const normalized = `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`;
  requireEvidence(Number.isFinite(Date.parse(normalized)));
  requireEvidence(new Date(normalized).toISOString() === normalized);
}
function optional(value: unknown, accepted: unknown): void {
  if (value === undefined) return;
  requireEvidence(value === accepted);
}
function nullable(value: unknown, accepted?: unknown): void {
  if (value === undefined || value === null) return;
  requireEvidence(accepted !== undefined && value === accepted);
}
function checkedSide(value: Side): Side {
  requireEvidence(value === "source" || value === "restored");
  return value;
}
function database(value: unknown, side: Side): void {
  const row = object(value);
  const id = watchlistRestoreProofLocation(side).databaseId;
  requireEvidence(row.$id === id);
  requireEvidence(
    row.name ===
      (side === "source"
        ? "Watchlist backup qualification"
        : "Watchlist restored qualification"),
  );
  requireEvidence(row.enabled === true);
  requireEvidence(row.type === "legacy" || row.type === "tablesdb");
  metadataTime(row.$createdAt);
  metadataTime(row.$updatedAt);
  nullable(row.specification, "serverless");
  nullable(row.replicas, 0);
  nullable(row.status, "ready");
  nullable(row.error, "");
  nullable(row.engine);
  nullable(row.containerStatus);
  nullable(row.lifecycleState);
}
function column(value: unknown, expected: Column, side: Side): Availability {
  const row = object(value);
  const specific = expected.type === "bigint" ? ["min", "max"] : ["encrypt"];
  const size = expected.type === "varchar" ? ["size"] : [];
  knownKeys(row, [...COLUMN_FIELDS, ...specific, ...size]);
  requireEvidence(row.key === expected.key);
  requireEvidence(row.type === expected.type);
  requireEvidence(row.required === true);
  requireEvidence(row.error === "");
  optional(row.array, false);
  optional(row.default, null);
  metadataTime(row.$createdAt);
  metadataTime(row.$updatedAt);
  if (expected.type === "bigint") {
    requireEvidence(row.min === 1);
    requireEvidence(row.max === Number.MAX_SAFE_INTEGER);
  } else optional(row.encrypt, false);
  if (expected.size !== undefined) requireEvidence(row.size === expected.size);
  if (row.status === "available") return "available";
  requireEvidence(side === "source" && row.status === "processing");
  return "pending";
}
function tableIdentity(row: RecordValue, side: Side, id: TableId): void {
  requireEvidence(row.$id === id);
  requireEvidence(
    row.databaseId === watchlistRestoreProofLocation(side).databaseId,
  );
  requireEvidence(row.name === TABLE_NAMES[id]);
  requireEvidence(row.enabled === true);
  requireEvidence(row.rowSecurity === true);
  array(row.$permissions, 0);
  array(row.indexes, 0);
}
function table(value: unknown, side: Side, id: TableId): Availability {
  const row = object(value);
  tableIdentity(row, side, id);
  metadataTime(row.$createdAt);
  metadataTime(row.$updatedAt);
  const columns = array(row.columns, 7).map(object);
  requireEvidence(columns.length === 7);
  requireEvidence(new Set(columns.map((item) => item.key)).size === 7);
  const states = COLUMNS[id].map((expected) =>
    column(
      columns.find((item) => item.key === expected.key),
      expected,
      side,
    ),
  );
  requireEvidence(
    Number.isSafeInteger(row.bytesMax) && (row.bytesMax as number) >= 0,
  );
  requireEvidence(
    Number.isSafeInteger(row.bytesUsed) && (row.bytesUsed as number) >= 0,
  );
  requireEvidence(
    row.bytesMax === 0 || (row.bytesUsed as number) <= (row.bytesMax as number),
  );
  return states.includes("pending") ? "pending" : "available";
}
function listed(
  value: unknown,
  field: "tables" | "rows",
  maximum: number,
): unknown[] {
  const row = object(value);
  exactKeys(row, ["total", field]);
  requireEvidence(Number.isSafeInteger(row.total));
  const values = array(row[field], maximum);
  requireEvidence(row.total === values.length);
  return values;
}
function tableInventory(value: unknown, side: Side): void {
  const tables = listed(value, "tables", 3).map(object);
  requireEvidence(tables.length === 2);
  requireEvidence(new Set(tables.map((row) => row.$id)).size === 2);
  for (const id of ["watchlists", "receipts"] as const) {
    const row = tables.find((item) => item.$id === id);
    requireEvidence(row);
    tableIdentity(row, side, id);
  }
}

/** The caller must bind list requests to limit-only queries with total=true. */
export function inspectWatchlistRestoreSchema(
  input: SchemaInput,
): Availability {
  return guarded(() => {
    const side = checkedSide(input.side);
    database(input.database, side);
    const states = [
      table(input.watchlists, side, "watchlists"),
      table(input.receipts, side, "receipts"),
    ];
    if (input.tables === undefined) requireEvidence(side === "source");
    else tableInventory(input.tables, side);
    return states.includes("pending") ? "pending" : "available";
  });
}

function rowEnvelope(
  value: unknown,
  side: Side,
  version?: Version,
): RecordValue {
  const row = object(value);
  const location = watchlistRestoreProofLocation(side, version);
  const fields = COLUMNS[location.tableId].map((item) => item.key);
  exactKeys(row, [...PLATFORM_FIELDS, ...fields]);
  requireEvidence(row.$id === location.rowId);
  requireEvidence(row.$databaseId === location.databaseId);
  requireEvidence(row.$tableId === location.tableId);
  requireEvidence(typeof row.$sequence === "string");
  requireEvidence(/^\d{1,128}$/u.test(row.$sequence));
  metadataTime(row.$createdAt);
  metadataTime(row.$updatedAt);
  row.$permissions = array(row.$permissions, 0);
  requireEvidence(row.ownerId === WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId);
  requireEvidence(row.watchlistId === "main");
  return row;
}
function fingerprint(row: RecordValue, fields: readonly string[]): string {
  return watchlistRestoreProofHash(
    JSON.stringify(
      Object.fromEntries([...fields].sort().map((key) => [key, row[key]])),
    ),
  );
}
function rowEvidence(
  value: unknown,
  side: Side,
  currentVersion: Version,
  receiptVersion?: Version,
): RowFingerprint {
  const row = rowEnvelope(value, side, receiptVersion);
  const version = receiptVersion ?? currentVersion;
  const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
  requireEvidence(row.version === version);
  requireEvidence(row.digestSha256 === pin.payloadSha256);
  if (receiptVersion === undefined) {
    requireEvidence(row.payloadJson === pin.payloadJson);
    requireEvidence(row.createdAt === WATCHLIST_RESTORE_PROOF_TIMES[0]);
    requireEvidence(row.updatedAt === pin.committedAt);
  } else {
    requireEvidence(row.keyDigest === pin.keySha256);
    requireEvidence(row.requestDigest === pin.requestSha256);
    requireEvidence(row.committedAt === pin.committedAt);
  }
  const fields = COLUMNS[
    receiptVersion === undefined ? "watchlists" : "receipts"
  ].map((item) => item.key);
  return Object.freeze({
    side,
    rowId: row.$id as string,
    sha256: fingerprint(row, Object.keys(row)),
    applicationSha256: fingerprint(row, fields),
  });
}

/** Empty inventories prove table contents, never absence of the target database. */
export function inspectWatchlistRestoreRows(
  input: RowsInput,
): readonly RowFingerprint[] {
  return guarded(() => {
    const side = checkedSide(input.side);
    requireEvidence(["empty", "baseline", "final"].includes(input.stage));
    const current = listed(input.watchlists, "rows", 4);
    const receipts = listed(input.receipts, "rows", 4);
    if (input.stage === "empty") {
      requireEvidence(current.length === 0 && receipts.length === 0);
      return Object.freeze([]);
    }
    const version = side === "restored" && input.stage === "final" ? 3 : 2;
    requireEvidence(current.length === 1);
    requireEvidence(receipts.length === version);
    const rows = receipts.map(object);
    requireEvidence(new Set(rows.map((row) => row.$id)).size === version);
    const result = [rowEvidence(current[0], side, version)];
    for (const receiptVersion of [1, 2, 3] as const) {
      if (receiptVersion > version) break;
      const id = watchlistRestoreProofLocation(side, receiptVersion).rowId;
      result.push(
        rowEvidence(
          rows.find((row) => row.$id === id),
          side,
          version,
          receiptVersion,
        ),
      );
    }
    return Object.freeze(result);
  });
}
