import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  VALUATION_PROOF_TARGET,
  VALUATION_PROOF_SCHEMA,
  VALUATION_PROOF_SCHEMA_SHA256,
  VALUATION_PROOF_CREATE_OPERATIONS,
  inspectValuationProofSchema,
} from "./valuation-assumptions-proof-schema";

type Row = Record<string, unknown>;
type Table = Row & { columns: Row[] };
const TIME = "2026-10-19T01:00:00.123456+00:00";
function columns(current: boolean): Row[] {
  const strings = current
    ? {
        ownerId: 36,
        resourceId: 4,
        digestSha256: 64,
        createdAt: 24,
        updatedAt: 24,
      }
    : {
        ownerId: 36,
        resourceId: 4,
        keyDigest: 64,
        requestDigest: 64,
        digestSha256: 64,
        committedAt: 24,
      };
  const base = {
    required: true,
    array: false,
    default: null,
    status: "available",
    error: "",
    $createdAt: TIME,
    $updatedAt: TIME,
  };
  const result: Row[] = Object.entries(strings).map(([key, size]) => ({
    ...base,
    key,
    type: "varchar",
    size,
    encrypt: false,
  }));
  result.push({
    ...base,
    key: "version",
    type: "bigint",
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (current)
    result.push({
      ...base,
      key: "payloadJson",
      type: "mediumtext",
      encrypt: false,
    });
  return result;
}
function fixture() {
  const database: Row = {
    $id: "investment_managed_valuation_v1",
    name: "Managed valuation assumptions",
    enabled: true,
    type: "tablesdb",
    $createdAt: TIME,
    $updatedAt: TIME,
  };
  const table = (id: "assumptions" | "receipts"): Table => ({
    $id: id,
    databaseId: "investment_managed_valuation_v1",
    name:
      id === "assumptions"
        ? "Valuation assumptions"
        : "Valuation assumption receipts",
    enabled: true,
    rowSecurity: true,
    $permissions: [],
    indexes: [],
    $createdAt: TIME,
    $updatedAt: TIME,
    bytesMax: 0,
    bytesUsed: 500,
    columns: columns(id === "assumptions"),
  });
  const assumptions = table("assumptions"),
    receipts = table("receipts");
  return {
    database,
    tableList: { total: 2, tables: [assumptions, receipts] },
    assumptions,
    receipts,
  };
}
type Fixture = ReturnType<typeof fixture>;
function column(f: Fixture, key: string): Row {
  return f.assumptions.columns.find((value) => value.key === key)!;
}
function inspect(f: Fixture) {
  return inspectValuationProofSchema(f.database, f.tableList);
}
function nullPrototypes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(nullPrototypes);
  if (value === null) return null;
  if (typeof value !== "object") return value;
  return Object.assign(
    Object.create(null) as object,
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, nullPrototypes(item)]),
    ),
  );
}
function stringifier(value: object, fn: () => string) {
  Object.defineProperty(value, "toString", {
    value: fn,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value === null) return null;
  if (typeof value !== "object") return value;
  const row = value as Row;
  return Object.fromEntries(
    Object.keys(row)
      .sort()
      .map((key) => [key, ordered(row[key])]),
  );
}

describe("fixed valuation schema admission", () => {
  it("admits the complete SDK29 shape and returns frozen finite digests only", () => {
    const f = fixture();
    const result = inspect(f)!;
    const { metadataSha256, ...fixed } = result;
    expect(metadataSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(fixed).toEqual({
      version: 1,
      schemaSha256: VALUATION_PROOF_SCHEMA_SHA256,
      databaseId: "investment_managed_valuation_v1",
      currentTableId: "assumptions",
      receiptsTableId: "receipts",
      tableCount: 2,
      columnCount: 14,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TIME);
    expect(JSON.stringify(result)).not.toContain("columns");
    f.assumptions.bytesUsed = 501;
    expect(inspect(f)?.metadataSha256).not.toBe(result.metadataSha256);
    f.assumptions.bytesMax = 501;
    expect(inspect(f)).not.toBeNull();
  });
  it("admits nested null prototypes and only the SDK top-level stringifier descriptors", () => {
    const f = fixture(),
      call = vi.fn(() => {
        throw Error("must not invoke");
      });
    const database = nullPrototypes(f.database) as object;
    const tableList = nullPrototypes(f.tableList) as object;
    stringifier(database, call);
    stringifier(tableList, call);
    expect(inspectValuationProofSchema(database, tableList)).toEqual(
      inspect(f),
    );
    expect(call).not.toHaveBeenCalled();
  });
  it("accepts documented omitted/null serverless backing fields without inferring defaults", () => {
    const f = fixture();
    Object.assign(f.database, {
      type: "legacy",
      specification: null,
      replicas: null,
      status: null,
      engine: null,
      error: null,
      containerStatus: null,
      lifecycleState: null,
    });
    expect(inspect(f)).not.toBeNull();
    Object.assign(f.database, {
      specification: "serverless",
      replicas: 0,
      status: "ready",
      error: "",
    });
    expect(inspect(f)).not.toBeNull();
    for (const table of f.tableList.tables) {
      for (const item of table.columns) {
        delete item.array;
        delete item.default;
        delete item.encrypt;
      }
    }
    expect(inspect(f)).not.toBeNull();
  });
  it("does not require backup metadata or include its contents in the fingerprint", () => {
    const f = fixture(),
      baseline = inspect(f);
    f.database.policies = [{ id: "invented-policy-marker", enabled: false }];
    f.database.archives = [
      { status: "invented-archive-marker", extra: [null, 1, false] },
    ];
    expect(inspect(f)).toEqual(baseline);
    expect(JSON.stringify(inspect(f))).not.toContain("marker");
    f.database.policies = null;
    f.database.archives = null;
    expect(inspect(f)).toEqual(baseline);
  });
  it("canonicalizes table, column and object key order while retaining observed values", () => {
    const f = fixture(),
      baseline = inspect(f);
    f.tableList.tables.reverse();
    f.assumptions.columns.reverse();
    f.receipts.columns.reverse();
    f.database = Object.fromEntries(Object.entries(f.database).reverse());
    expect(inspect(f)).toEqual(baseline);
    f.database.$updatedAt = "2026-10-19T02:00:00Z";
    expect(inspect(f)?.metadataSha256).not.toBe(baseline?.metadataSha256);
  });
});

it.each(["$id", "name", "enabled", "type", "$createdAt", "$updatedAt"])(
  "requires database metadata %s",
  (key) => {
    const f = fixture();
    delete f.database[key];
    expect(inspect(f)).toBeNull();
  },
);
it.each([
  "$id",
  "databaseId",
  "name",
  "enabled",
  "rowSecurity",
  "$permissions",
  "indexes",
  "columns",
  "$createdAt",
  "$updatedAt",
  "bytesMax",
  "bytesUsed",
])("requires full table metadata %s", (key) => {
  const f = fixture();
  delete f.receipts[key];
  expect(inspect(f)).toBeNull();
});
it.each([
  "key",
  "type",
  "status",
  "error",
  "required",
  "$createdAt",
  "$updatedAt",
  "min",
  "max",
])("requires version column metadata %s", (key) => {
  const f = fixture();
  delete column(f, "version")[key];
  expect(inspect(f)).toBeNull();
});

const refusals: Readonly<Record<string, (f: Fixture) => void>> = {
  "foreign database": (f) => {
    f.database.$id = "foreign";
  },
  "wrong database name": (f) => {
    f.database.name = "other";
  },
  "disabled database": (f) => {
    f.database.enabled = false;
  },
  "wrong product": (f) => {
    f.database.type = "documentsdb";
  },
  "dedicated backing": (f) => {
    f.database.specification = "s-2vcpu-4gb";
  },
  "extra replica": (f) => {
    f.database.replicas = 1;
  },
  "pending database": (f) => {
    f.database.status = "provisioning";
  },
  "nonnull engine": (f) => {
    f.database.engine = "mysql";
  },
  "database error": (f) => {
    f.database.error = "upstream detail";
  },
  "unknown metadata": (f) => {
    f.database.unreviewed = true;
  },
  "missing timestamp": (f) => {
    delete f.database.$createdAt;
  },
  "invalid calendar time": (f) => {
    f.database.$updatedAt = "2026-02-30T00:00:00Z";
  },
  "non UTC time": (f) => {
    f.database.$updatedAt = "2026-10-19T00:00:00-01:00";
  },
  "truncated table page": (f) => {
    f.tableList.total = 3;
  },
  "unknown list field": (f) => {
    Object.assign(f.tableList, { next: "x" });
  },
  "missing table": (f) => {
    f.tableList.tables.pop();
  },
  "duplicate table": (f) => {
    f.tableList.tables[1] = f.assumptions;
  },
  "foreign table database": (f) => {
    f.assumptions.databaseId = "foreign";
  },
  "wrong table name": (f) => {
    f.receipts.name = "other";
  },
  "disabled table": (f) => {
    f.assumptions.enabled = false;
  },
  "row security disabled": (f) => {
    f.assumptions.rowSecurity = false;
  },
  "table grants": (f) => {
    f.assumptions.$permissions = ['read("any")'];
  },
  "unexpected index": (f) => {
    f.assumptions.indexes = [{ key: "unexpected" }];
  },
  "negative bytes": (f) => {
    f.assumptions.bytesMax = -1;
  },
  "unsafe bytes": (f) => {
    f.assumptions.bytesUsed = Number.MAX_SAFE_INTEGER + 1;
  },
  "missing required accounting": (f) => {
    delete f.assumptions.bytesUsed;
  },
  "declared table overflow": (f) => {
    f.assumptions.bytesMax = 499;
  },
  "missing column": (f) => {
    f.assumptions.columns.pop();
  },
  "duplicate column": (f) => {
    f.assumptions.columns[0] = f.assumptions.columns[1]!;
  },
  "column processing": (f) => {
    column(f, "payloadJson").status = "processing";
  },
  "column failure": (f) => {
    column(f, "payloadJson").status = "failed";
  },
  "column error": (f) => {
    column(f, "payloadJson").error = "upstream";
  },
  "optional column": (f) => {
    column(f, "ownerId").required = false;
  },
  "array column": (f) => {
    column(f, "ownerId").array = true;
  },
  "null array": (f) => {
    column(f, "ownerId").array = null;
  },
  "nonempty default": (f) => {
    column(f, "ownerId").default = "x";
  },
  encryption: (f) => {
    column(f, "ownerId").encrypt = true;
  },
  "null encryption": (f) => {
    column(f, "ownerId").encrypt = null;
  },
  "wide identity": (f) => {
    column(f, "ownerId").size = 37;
  },
  "missing varchar size": (f) => {
    delete column(f, "ownerId").size;
  },
  "small text column": (f) => {
    column(f, "payloadJson").type = "text";
  },
  "unsupported mediumtext size": (f) => {
    column(f, "payloadJson").size = 262144;
  },
  "wrong version type": (f) => {
    column(f, "version").type = "integer";
  },
  "zero min": (f) => {
    column(f, "version").min = 0;
  },
  "unbounded max": (f) => {
    column(f, "version").max = "9007199254740991";
  },
  "unknown column field": (f) => {
    column(f, "version").encrypt = false;
  },
};
it.each(Object.entries(refusals))(
  "refuses %s without reporting raw metadata",
  (_name, mutate) => {
    const f = fixture();
    mutate(f);
    expect(inspect(f)).toBeNull();
  },
);

describe("metadata data-only boundaries", () => {
  it("never invokes a getter on required, unknown or nested backup metadata", () => {
    for (const position of ["required", "unknown", "nested"] as const) {
      const f = fixture(),
        getter = vi.fn(() => {
          throw Error("must not execute");
        });
      const locations = {
        required: { row: f.database, key: "name" },
        unknown: { row: f.database, key: "unknown" },
        nested: { row: {} as Row, key: "hidden" },
      };
      const selected = locations[position];
      Object.defineProperty(selected.row, selected.key, {
        get: getter,
        enumerable: true,
      });
      if (position === "nested") f.database.policies = [selected.row];
      expect(inspect(f)).toBeNull();
      expect(getter).not.toHaveBeenCalled();
    }
  });
  it("refuses hidden, symbol, prototype, sparse and custom array fields", () => {
    const mutations = [
      (f: Fixture) => Object.defineProperty(f.database, "hidden", { value: 1 }),
      (f: Fixture) => Object.assign(f.database, { [Symbol("extra")]: true }),
      (f: Fixture) => {
        Object.setPrototypeOf(f.database, { inherited: true });
      },
      (f: Fixture) => {
        Reflect.deleteProperty(f.assumptions.columns, "0");
      },
      (f: Fixture) => Object.assign(f.assumptions.columns, { extra: true }),
      (f: Fixture) => {
        Object.setPrototypeOf(f.tableList.tables, null);
      },
    ];
    for (const mutate of mutations) {
      const f = fixture();
      mutate(f);
      expect(inspect(f)).toBeNull();
    }
  });
  it("does not invoke or admit malformed or nested stringifiers", () => {
    const fn = vi.fn(() => {
      throw Error("must not execute");
    });
    const f = fixture();
    stringifier(f.assumptions, fn);
    expect(inspect(f)).toBeNull();
    const other = fixture();
    Object.defineProperty(other.database, "toString", {
      value: fn,
      enumerable: false,
    });
    expect(inspect(other)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
  it("refuses array index accessors without reading them", () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw Error("must not execute");
    });
    Object.defineProperty(f.assumptions.columns, "0", {
      enumerable: true,
      get: getter,
    });
    expect(inspect(f)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, undefined, 1n, () => "x", new Date(0)])(
    "rejects non JSON nested metadata %s",
    (value) => {
      const f = fixture();
      f.database.policies = [{ value }];
      expect(inspect(f)).toBeNull();
    },
  );
  it("bounds ignored backup metadata bytes, depth, nodes and cycles", () => {
    const cycle: Row = {};
    cycle.self = cycle;
    const mutations = [
      (f: Fixture) => {
        f.database.archives = [{ payload: "x".repeat(4097) }];
      },
      (f: Fixture) => {
        f.database.archives = Array.from({ length: 24 }, () => ({
          payload: "x".repeat(4096),
        }));
      },
      (f: Fixture) => {
        f.database.archives = Array(33).fill(null);
      },
      (f: Fixture) => {
        f.database.archives = [cycle];
      },
      (f: Fixture) => {
        f.database.archives = [[[[[[[[[0]]]]]]]]];
      },
      (f: Fixture) => {
        f.database.archives = Array.from({ length: 32 }, () =>
          Array.from({ length: 32 }, () => 0),
        );
      },
    ];
    for (const mutate of mutations) {
      const f = fixture();
      mutate(f);
      expect(inspect(f)).toBeNull();
    }
  });
});

describe("fixed declarative create manifest", () => {
  it("pins the current production target and exactly17 explicit schema creates without defaults or execution", () => {
    expect(VALUATION_PROOF_TARGET).toEqual({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
      project: "6abac57a0007b7c1a671",
      databaseId: "investment_managed_valuation_v1",
      currentTableId: "assumptions",
      receiptsTableId: "receipts",
    });
    expect(VALUATION_PROOF_CREATE_OPERATIONS).toHaveLength(17);
    expect(
      VALUATION_PROOF_CREATE_OPERATIONS.map((value) => value.ordinal),
    ).toEqual(Array.from({ length: 17 }, (_, index) => index + 1));
    expect(VALUATION_PROOF_CREATE_OPERATIONS[0]).toMatchObject({
      sdkMethod: "create",
      path: "/v1/tablesdb",
      params: { enabled: true, specification: "serverless", replicas: 0 },
    });
    expect(
      VALUATION_PROOF_CREATE_OPERATIONS.slice(1, 3).map(
        (value) => value.params,
      ),
    ).toEqual([
      {
        databaseId: VALUATION_PROOF_TARGET.databaseId,
        tableId: "assumptions",
        name: "Valuation assumptions",
        permissions: [],
        rowSecurity: true,
        enabled: true,
      },
      {
        databaseId: VALUATION_PROOF_TARGET.databaseId,
        tableId: "receipts",
        name: "Valuation assumption receipts",
        permissions: [],
        rowSecurity: true,
        enabled: true,
      },
    ]);
  });
  it("keeps every planned write explicit and binds all14 distinct column creates", () => {
    for (const operation of VALUATION_PROOF_CREATE_OPERATIONS) {
      expect(operation.method).toBe("POST");
      expect(operation.params.databaseId).toBe(
        VALUATION_PROOF_TARGET.databaseId,
      );
      expect(operation.params).not.toHaveProperty("default");
      expect(operation.params).not.toHaveProperty("xdefault");
      expect(Object.isFrozen(operation.params)).toBe(true);
    }
    const created = VALUATION_PROOF_CREATE_OPERATIONS.slice(3);
    expect(
      new Set(
        created.map(
          (value) =>
            `${String(value.params.tableId)}/${String(value.params.key)}`,
        ),
      ).size,
    ).toBe(14);
    for (const operation of created) {
      expect(operation.params.required).toBe(true);
      expect(operation.params.array).toBe(false);
    }
  });
  it("freezes descriptors deeply and binds a deterministic schema digest", () => {
    expect(VALUATION_PROOF_SCHEMA_SHA256).toMatch(/^[0-9a-f]{64}$/u);
    expect(VALUATION_PROOF_SCHEMA_SHA256).toBe(
      "0cef8770dbd3ecdf767b7be865a6f62bb896174eccd54a17acd32e6f9619f4e6",
    );
    expect(Object.isFrozen(VALUATION_PROOF_SCHEMA.tables[0]!.columns[0])).toBe(
      true,
    );
    expect(Object.isFrozen(VALUATION_PROOF_CREATE_OPERATIONS)).toBe(true);
    expect(
      createHash("sha256")
        .update(JSON.stringify(ordered(VALUATION_PROOF_SCHEMA)))
        .digest("hex"),
    ).toBe(VALUATION_PROOF_SCHEMA_SHA256);
    expect(
      VALUATION_PROOF_CREATE_OPERATIONS.filter(
        (value) => value.sdkMethod === "createBigIntColumn",
      ).map((value) => value.params),
    ).toEqual([
      {
        databaseId: VALUATION_PROOF_TARGET.databaseId,
        tableId: "assumptions",
        key: "version",
        required: true,
        array: false,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
      },
      {
        databaseId: VALUATION_PROOF_TARGET.databaseId,
        tableId: "receipts",
        key: "version",
        required: true,
        array: false,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
      },
    ]);
  });
});
