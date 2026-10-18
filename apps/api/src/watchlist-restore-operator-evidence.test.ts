import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
  WATCHLIST_RESTORE_PROOF_PRINCIPAL,
  WATCHLIST_RESTORE_PROOF_TIMES,
  watchlistRestoreProofLocation,
  type WatchlistRestoreProofSide,
} from "./watchlist-restore-proof-data";
import {
  inspectWatchlistRestoreRows,
  inspectWatchlistRestoreSchema,
  WatchlistRestoreEvidenceError,
} from "./watchlist-restore-operator-evidence";

type Side = WatchlistRestoreProofSide;
type Row = Record<string, unknown>;
type Table = Row & { columns: Row[] };
type Version = 1 | 2 | 3;
const TIME = "2026-10-18T01:00:00.123456+00:00";
const currentFields = [
  "ownerId",
  "watchlistId",
  "version",
  "payloadJson",
  "digestSha256",
  "createdAt",
  "updatedAt",
];
const receiptFields = [
  "ownerId",
  "watchlistId",
  "keyDigest",
  "requestDigest",
  "version",
  "digestSha256",
  "committedAt",
];

function schemaColumns(id: "watchlists" | "receipts"): Row[] {
  const strings =
    id === "watchlists"
      ? {
          ownerId: 36,
          watchlistId: 4,
          digestSha256: 64,
          createdAt: 24,
          updatedAt: 24,
        }
      : {
          ownerId: 36,
          watchlistId: 4,
          keyDigest: 64,
          requestDigest: 64,
          digestSha256: 64,
          committedAt: 24,
        };
  const base = {
    status: "available",
    error: "",
    required: true,
    array: false,
    default: null,
    $createdAt: TIME,
    $updatedAt: TIME,
  };
  const result = Object.entries(strings).map(([key, size]) => ({
    ...base,
    key,
    type: "varchar",
    size,
    encrypt: false,
  }));
  const columns: Row[] = [
    ...result,
    {
      ...base,
      key: "version",
      type: "bigint",
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    },
  ];
  if (id === "watchlists")
    columns.push({
      ...base,
      key: "payloadJson",
      type: "mediumtext",
      encrypt: false,
    });
  return columns;
}
function schema(side: Side = "source") {
  const databaseId = watchlistRestoreProofLocation(side).databaseId;
  const table = (id: "watchlists" | "receipts"): Table => ({
    $id: id,
    databaseId,
    name:
      id === "watchlists"
        ? "Watchlist qualification"
        : "Watchlist qualification receipts",
    $createdAt: TIME,
    $updatedAt: TIME,
    enabled: true,
    rowSecurity: true,
    $permissions: [],
    indexes: [],
    columns: schemaColumns(id),
    bytesMax: 0,
    bytesUsed: 500,
  });
  const watchlists = table("watchlists"),
    receipts = table("receipts");
  return {
    side,
    database: {
      $id: databaseId,
      name:
        side === "source"
          ? "Watchlist backup qualification"
          : "Watchlist restored qualification",
      enabled: true,
      type: "tablesdb",
      $createdAt: TIME,
      $updatedAt: TIME,
    } as Row,
    watchlists,
    receipts,
    tables: { total: 2, tables: [watchlists, receipts] },
  };
}
function column(input: ReturnType<typeof schema>, key: string): Row {
  return input.watchlists.columns.find((item) => item.key === key)!;
}
function row(side: Side, current: Version, receipt?: Version): Row {
  const location = watchlistRestoreProofLocation(side, receipt);
  const version = receipt ?? current;
  const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
  const result: Row = {
    $id: location.rowId,
    $tableId: location.tableId,
    $databaseId: location.databaseId,
    $sequence: String(receipt ?? 4),
    $createdAt: TIME,
    $updatedAt: TIME,
    $permissions: [],
    ownerId: WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId,
    watchlistId: "main",
    version,
    digestSha256: pin.payloadSha256,
  };
  if (receipt === undefined)
    return {
      ...result,
      payloadJson: pin.payloadJson,
      createdAt: WATCHLIST_RESTORE_PROOF_TIMES[0],
      updatedAt: pin.committedAt,
    };
  return {
    ...result,
    keyDigest: pin.keySha256,
    requestDigest: pin.requestSha256,
    committedAt: pin.committedAt,
  };
}
function inventory(
  side: Side = "source",
  stage: "empty" | "baseline" | "final" = "baseline",
) {
  const version = side === "restored" && stage === "final" ? 3 : 2;
  const receipts =
    stage === "empty"
      ? []
      : ([1, 2, 3] as const)
          .filter((value) => value <= version)
          .map((value) => row(side, version, value));
  return {
    side,
    stage,
    watchlists: {
      total: stage === "empty" ? 0 : 1,
      rows: stage === "empty" ? [] : [row(side, version)],
    },
    receipts: { total: receipts.length, rows: receipts },
  };
}
function rejected(action: () => unknown) {
  expect(action).toThrowError(WatchlistRestoreEvidenceError);
  expect(action).toThrowError("Watchlist restore evidence refused.");
}
function referenceHash(value: Row, fields = Object.keys(value)): string {
  return createHash("sha256")
    .update(JSON.stringify(value, [...fields].sort()))
    .digest("hex");
}
function sdkResponse(value: Row): Row {
  Object.defineProperty(value, "toString", {
    value: () => {
      throw new Error("must not invoke");
    },
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return value;
}

describe("fixed Watchlist restore schema", () => {
  it("admits complete source and restored schemas and the documented legacy type", () => {
    expect(inspectWatchlistRestoreSchema(schema())).toBe("available");
    expect(inspectWatchlistRestoreSchema(schema("restored"))).toBe("available");
    const legacy = schema();
    legacy.database.type = "legacy";
    expect(inspectWatchlistRestoreSchema(legacy)).toBe("available");
  });

  it("permits omitted/null backing metadata and explicit serverless/zero only", () => {
    const input = schema();
    Object.assign(input.database, {
      specification: "serverless",
      replicas: 0,
      status: "ready",
      error: "",
      engine: null,
      containerStatus: null,
      lifecycleState: null,
    });
    expect(inspectWatchlistRestoreSchema(input)).toBe("available");
    for (const key of ["specification", "replicas", "status", "error"])
      input.database[key] = null;
    expect(inspectWatchlistRestoreSchema(input)).toBe("available");
  });

  it("allows table-list omission only in source availability batches", () => {
    const source = { ...schema(), tables: undefined };
    expect(inspectWatchlistRestoreSchema(source)).toBe("available");
    const restored = { ...schema("restored"), tables: undefined };
    rejected(() => inspectWatchlistRestoreSchema(restored));
  });

  it("reports source processing while validating both complete table definitions", () => {
    const input = schema();
    column(input, "payloadJson").status = "processing";
    expect(inspectWatchlistRestoreSchema(input)).toBe("pending");
    input.receipts.columns[0]!.required = false;
    rejected(() => inspectWatchlistRestoreSchema(input));
  });

  it.each(["pending", "deleting", "stuck", "failed", "unknown", "", null])(
    "refuses undocumented or terminal column state %j",
    (status) => {
      const input = schema();
      column(input, "payloadJson").status = status;
      rejected(() => inspectWatchlistRestoreSchema(input));
    },
  );

  it("refuses processing at the restored target", () => {
    const input = schema("restored");
    column(input, "payloadJson").status = "processing";
    rejected(() => inspectWatchlistRestoreSchema(input));
  });

  it.each([
    ["$id", "wrong-database"],
    ["name", "wrong name"],
    ["enabled", false],
    ["type", "database"],
    ["type", "documentsdb"],
    ["specification", "s-2vcpu-4gb"],
    ["replicas", 1],
    ["replicas", -1],
    ["replicas", "0"],
    ["status", "pending"],
    ["engine", "mysql"],
    ["containerStatus", "active"],
    ["lifecycleState", "warm"],
    ["error", "private-provider-error"],
    ["$createdAt", "2026-02-30T00:00:00Z"],
  ])("refuses database %s=%j", (field, value) => {
    const input = schema();
    input.database[field] = value;
    rejected(() => inspectWatchlistRestoreSchema(input));
  });

  it.each([
    ["$id", "unknown"],
    ["databaseId", "other-source"],
    ["name", "wrong table"],
    ["enabled", false],
    ["rowSecurity", false],
    ["$permissions", ['read("any")']],
    ["indexes", [{ key: "unexpected" }]],
    ["bytesMax", -1],
    ["bytesUsed", 1.5],
    ["bytesUsed", Number.MAX_SAFE_INTEGER + 1],
    ["$updatedAt", "not a time"],
  ])("refuses table %s=%j", (field, value) => {
    const input = schema();
    input.watchlists[field] = value;
    rejected(() => inspectWatchlistRestoreSchema(input));
  });

  it("refuses inconsistent finite capacity without treating zero as quota proof", () => {
    const input = schema();
    input.watchlists.bytesMax = 499;
    rejected(() => inspectWatchlistRestoreSchema(input));
    input.watchlists.bytesMax = 500;
    expect(inspectWatchlistRestoreSchema(input)).toBe("available");
  });

  it("normalizes only omitted optional array, encrypt and default fields", () => {
    const input = schema();
    for (const table of [input.watchlists, input.receipts]) {
      for (const value of table.columns) {
        delete value.array;
        delete value.encrypt;
        delete value.default;
      }
    }
    expect(inspectWatchlistRestoreSchema(input)).toBe("available");
  });

  it.each([
    ["ownerId", "type", "string"],
    ["ownerId", "size", 37],
    ["watchlistId", "size", 3],
    ["digestSha256", "size", 63],
    ["createdAt", "size", 25],
    ["updatedAt", "size", 23],
    ["version", "min", 0],
    ["version", "max", Number.MAX_SAFE_INTEGER - 1],
    ["version", "min", "1"],
    ["payloadJson", "type", "text"],
    ["payloadJson", "required", false],
    ["payloadJson", "array", true],
    ["payloadJson", "array", null],
    ["payloadJson", "encrypt", true],
    ["payloadJson", "default", ""],
    ["payloadJson", "error", "private-error"],
    ["payloadJson", "extra", "unreviewed"],
    ["payloadJson", "$createdAt", null],
  ])("refuses column %s %s=%j", (key, field, value) => {
    const input = schema();
    column(input, key)[field] = value;
    rejected(() => inspectWatchlistRestoreSchema(input));
  });

  it.each(["missing", "duplicate", "extra"])(
    "requires exactly seven distinct expected columns: %s",
    (kind) => {
      const input = schema();
      if (kind === "missing") input.watchlists.columns.pop();
      if (kind === "duplicate")
        input.watchlists.columns[1] = input.watchlists.columns[0]!;
      if (kind === "extra")
        input.watchlists.columns.push({
          ...input.watchlists.columns[0],
          key: "unexpected",
        });
      rejected(() => inspectWatchlistRestoreSchema(input));
    },
  );

  it.each(["total", "duplicate", "extra", "wrong-location", "extra-page"])(
    "requires complete exact table inventory: %s",
    (kind) => {
      const input = schema();
      if (kind === "total") input.tables.total = 3;
      if (kind === "duplicate")
        input.tables.tables[1] = input.tables.tables[0]!;
      if (kind === "extra")
        input.tables.tables.push({ ...input.watchlists, $id: "other" });
      if (kind === "wrong-location")
        input.tables.tables[1] = { ...input.receipts, databaseId: "other" };
      if (kind === "extra-page")
        Object.assign(input.tables, { cursor: "next" });
      rejected(() => inspectWatchlistRestoreSchema(input));
    },
  );
});

describe("complete fixed Watchlist row inventory", () => {
  it("admits empty source and the exact baseline/final sets", () => {
    expect(inspectWatchlistRestoreRows(inventory("source", "empty"))).toEqual(
      [],
    );
    expect(inspectWatchlistRestoreRows(inventory())).toHaveLength(3);
    expect(
      inspectWatchlistRestoreRows(inventory("source", "final")),
    ).toHaveLength(3);
    expect(inspectWatchlistRestoreRows(inventory("restored"))).toHaveLength(3);
    expect(
      inspectWatchlistRestoreRows(inventory("restored", "final")),
    ).toHaveLength(4);
  });

  it("matches the proof's sorted-field hashes and preserves immutable evidence", () => {
    const input = inventory();
    const evidence = inspectWatchlistRestoreRows(input);
    expect(evidence[0]).toEqual({
      side: "source",
      rowId: input.watchlists.rows[0]!.$id,
      sha256: referenceHash(input.watchlists.rows[0]!),
      applicationSha256: referenceHash(
        input.watchlists.rows[0]!,
        currentFields,
      ),
    });
    expect(evidence[1]!.applicationSha256).toBe(
      referenceHash(input.receipts.rows[0]!, receiptFields),
    );
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(evidence.every(Object.isFrozen)).toBe(true);
  });

  it("joins baseline application evidence across databases while keeping full metadata distinct", () => {
    const source = inspectWatchlistRestoreRows(inventory());
    const restored = inspectWatchlistRestoreRows(inventory("restored"));
    expect(source.map((value) => value.applicationSha256)).toEqual(
      restored.map((value) => value.applicationSha256),
    );
    expect(source.map((value) => value.sha256)).not.toEqual(
      restored.map((value) => value.sha256),
    );
    expect(source).toEqual(
      inspectWatchlistRestoreRows(inventory("source", "final")),
    );
  });

  it("is independent of list order and detects later platform metadata changes", () => {
    const input = inventory();
    const before = inspectWatchlistRestoreRows(input);
    input.receipts.rows.reverse();
    expect(inspectWatchlistRestoreRows(input)).toEqual(before);
    input.watchlists.rows[0]!.$sequence = "9";
    const after = inspectWatchlistRestoreRows(input);
    expect(after[0]!.sha256).not.toBe(before[0]!.sha256);
    expect(after[0]!.applicationSha256).toBe(before[0]!.applicationSha256);
  });

  it.each([
    "total",
    "fraction",
    "extra",
    "duplicate",
    "missing",
    "page",
    "wrong-side",
  ])("refuses incomplete or changed row inventory: %s", (kind) => {
    const input = inventory();
    if (kind === "total") input.receipts.total = 3;
    if (kind === "fraction") input.receipts.total = 1.5;
    if (kind === "extra") {
      input.receipts.rows.push(row("source", 2, 3));
      input.receipts.total++;
    }
    if (kind === "duplicate") input.receipts.rows[1] = input.receipts.rows[0]!;
    if (kind === "missing") {
      input.receipts.rows.pop();
      input.receipts.total--;
    }
    if (kind === "page") Object.assign(input.receipts, { cursor: "next" });
    if (kind === "wrong-side") input.watchlists.rows[0] = row("restored", 2);
    rejected(() => inspectWatchlistRestoreRows(input));
  });

  it("refuses any row in an empty inventory and wrong current version at either final stage", () => {
    const empty = inventory("source", "empty");
    empty.watchlists = { total: 1, rows: [row("source", 2)] };
    rejected(() => inspectWatchlistRestoreRows(empty));
    const source = inventory("source", "final");
    source.watchlists.rows[0] = row("source", 3);
    rejected(() => inspectWatchlistRestoreRows(source));
    const restored = inventory("restored", "final");
    restored.watchlists.rows[0] = row("restored", 2);
    rejected(() => inspectWatchlistRestoreRows(restored));
  });

  it.each([
    ["$id", "wrong-id"],
    ["$tableId", "receipts"],
    ["$databaseId", "other"],
    ["$sequence", 1],
    ["$sequence", ""],
    ["$sequence", "-1"],
    ["$sequence", "1".repeat(129)],
    ["$permissions", ['read("any")']],
    ["$createdAt", "2025-02-29T00:00:00Z"],
    ["$updatedAt", null],
    ["ownerId", "different-owner"],
    ["watchlistId", "other"],
    ["version", 3],
    ["digestSha256", "0".repeat(64)],
    ["payloadJson", "{}"],
    ["createdAt", WATCHLIST_RESTORE_PROOF_TIMES[1]],
    ["updatedAt", WATCHLIST_RESTORE_PROOF_TIMES[0]],
    ["extra", "private-field"],
  ])("refuses current row %s=%j", (field, value) => {
    const input = inventory();
    input.watchlists.rows[0]![field] = value;
    rejected(() => inspectWatchlistRestoreRows(input));
  });

  it.each([
    "keyDigest",
    "requestDigest",
    "digestSha256",
    "committedAt",
    "version",
    "$id",
  ])("refuses a changed original receipt %s", (field) => {
    const input = inventory();
    input.receipts.rows[0]![field] = field === "version" ? 2 : "changed";
    rejected(() => inspectWatchlistRestoreRows(input));
  });

  it("requires canonical payload bytes even when JSON content is equivalent", () => {
    const input = inventory();
    const current = input.watchlists.rows[0]!;
    current.payloadJson = `${String(current.payloadJson)}\n`;
    rejected(() => inspectWatchlistRestoreRows(input));
  });
});

describe("bounded SDK-shaped evidence", () => {
  it("accepts the SDK's own non-enumerable data stringifier without invoking it", () => {
    const input = schema();
    sdkResponse(input.database);
    sdkResponse(input.watchlists);
    sdkResponse(input.receipts);
    sdkResponse(input.tables);
    expect(inspectWatchlistRestoreSchema(input)).toBe("available");
    const rows = inventory();
    sdkResponse(rows.watchlists);
    sdkResponse(rows.receipts);
    expect(inspectWatchlistRestoreRows(rows)).toHaveLength(3);
  });

  it.each([null, [], "private-provider-body", 1])(
    "sanitizes malformed evidence %j",
    (value) => {
      rejected(() =>
        inspectWatchlistRestoreSchema({ ...schema(), database: value }),
      );
      rejected(() =>
        inspectWatchlistRestoreRows({ ...inventory(), receipts: value }),
      );
    },
  );

  it("refuses sparse lists, accessors and malformed hidden fields without invoking them", () => {
    const input = inventory();
    input.receipts.rows = new Array<Row>(2);
    rejected(() => inspectWatchlistRestoreRows(input));
    const accessor = inventory();
    Object.defineProperty(accessor.watchlists.rows[0]!, "ownerId", {
      get: () => {
        throw new Error("private access");
      },
      enumerable: true,
    });
    rejected(() => inspectWatchlistRestoreRows(accessor));
    const hidden = schema();
    Object.defineProperty(hidden.database, "toString", {
      value: () => "private",
      enumerable: false,
    });
    rejected(() => inspectWatchlistRestoreSchema(hidden));
  });

  it("refuses prototype keys, list overflow and missing metadata", () => {
    const input = inventory();
    Object.defineProperty(input.watchlists.rows[0]!, "__proto__", {
      value: {},
      enumerable: true,
    });
    rejected(() => inspectWatchlistRestoreRows(input));
    const overflow = inventory();
    overflow.receipts.rows = Array.from({ length: 5 }, () =>
      row("source", 2, 1),
    );
    overflow.receipts.total = 5;
    rejected(() => inspectWatchlistRestoreRows(overflow));
    const missing = inventory();
    delete missing.watchlists.rows[0]!.$createdAt;
    rejected(() => inspectWatchlistRestoreRows(missing));
  });
});
