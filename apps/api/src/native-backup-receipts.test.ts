import { createHash } from "node:crypto";
import { Backups, BackupServices } from "node-appwrite";
import { MockAgent } from "undici";
import { describe, expect, it } from "vitest";
import {
  decodeNativeBackupArchive,
  decodeNativeBackupRestoration,
  NATIVE_BACKUP_DESTINATION_EVIDENCE,
  NATIVE_BACKUP_RECEIPT_LIMITS,
  NativeBackupReceiptError,
  type NativeBackupArchiveReceipt,
} from "./native-backup-receipts";
import { createRestoreOperatorTransport } from "./restore-operator-transport";

class OwnedMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}

const sourceResourceId = "invented_backup_source";
const requestedDestinationResourceId = "invented_restore_target";
const archiveId = "invented_archive_1";
const restorationId = "invented_restoration_1";
const migrationId = "invented_migration_1";
const startedAt = "2026-10-18T12:00:00.000+00:00";
const archiveExpected = { sourceResourceId, expectedResourceType: "database" };

function archive(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    $id: archiveId,
    $createdAt: "2026-10-18T12:00:00.000Z",
    $updatedAt: "2026-10-18T12:00:01.000Z",
    policyId: "",
    size: 1234,
    status: "completed",
    startedAt,
    migrationId,
    services: ["tablesdb"],
    resources: ["opaque-source-description"],
    resourceId: sourceResourceId,
    resourceType: "database",
    ...overrides,
  };
}

function restoration(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    $id: restorationId,
    $createdAt: "2026-10-18T12:00:02.000Z",
    $updatedAt: "2026-10-18T12:00:03.000Z",
    archiveId,
    policyId: "",
    status: "completed",
    startedAt,
    migrationId: "invented_restore_migration",
    services: ["tablesdb"],
    resources: ["opaque-restore-description"],
    options: "opaque native options",
    ...overrides,
  };
}

function restore(value: unknown) {
  return decodeNativeBackupRestoration(value, {
    archive: decodeNativeBackupArchive(archive(), archiveExpected),
    requestedDestinationResourceId,
    restorationId,
    migrationId: "invented_restore_migration",
  });
}

function invalid(action: () => unknown): void {
  expect(action).toThrowError(NativeBackupReceiptError);
  expect(action).toThrowError("Invalid native backup receipt");
}

async function requestBody(body: unknown): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>)
    chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

interface NativeReceiptRequest {
  method: "GET" | "POST";
  path: string;
  status: number;
  body?: string;
  response: Record<string, unknown>;
}

function nativeReceiptRequests(): NativeReceiptRequest[] {
  return [
    {
      method: "POST",
      path: "/v1/backups/archives",
      status: 202,
      body: JSON.stringify({
        services: ["tablesdb"],
        resourceId: sourceResourceId,
      }),
      response: archive({ status: "pending", startedAt: "", migrationId: "" }),
    },
    {
      method: "GET",
      path: `/v1/backups/archives/${archiveId}`,
      status: 200,
      response: archive(),
    },
    {
      method: "POST",
      path: "/v1/backups/restoration",
      status: 202,
      body: JSON.stringify({
        archiveId,
        services: ["tablesdb"],
        newResourceId: requestedDestinationResourceId,
      }),
      response: restoration({
        status: "pending",
        startedAt: "",
        migrationId: "",
      }),
    },
    {
      method: "GET",
      path: `/v1/backups/restorations/${restorationId}`,
      status: 200,
      response: restoration(),
    },
  ];
}

function nativeReceiptFixture() {
  const agent = new OwnedMockAgent();
  agent.disableNetConnect();
  const transport = createRestoreOperatorTransport({
    endpoint: "https://native-backup.example.invalid/v1",
    projectId: "invented-project",
    key: "invented-key",
    dispatcher: agent,
  });
  const pool = agent.get("https://native-backup.example.invalid");
  for (const step of nativeReceiptRequests()) {
    pool.intercept({ path: step.path, method: step.method }).reply(
      step.status,
      async (options) => {
        if (step.body !== undefined)
          expect(await requestBody(options.body)).toBe(step.body);
        return JSON.stringify(step.response);
      },
      { headers: { "content-type": "application/json" } },
    );
  }
  return { agent, transport };
}

type ReceiptTransport = ReturnType<typeof createRestoreOperatorTransport>;

async function archiveRoundtrip(transport: ReceiptTransport) {
  const created = await transport.runStep(
    { method: "POST", path: "/v1/backups/archives" },
    async (client) => {
      const value = await new Backups(client).createArchive({
        services: [BackupServices.Tablesdb],
        resourceId: sourceResourceId,
      });
      expect(Object.getOwnPropertyDescriptor(value, "toString")).toMatchObject({
        enumerable: false,
        configurable: true,
        writable: true,
      });
      expect(
        typeof Object.getOwnPropertyDescriptor(value, "toString")?.value,
      ).toBe("function");
      return decodeNativeBackupArchive(value, archiveExpected);
    },
  );
  return transport.runStep(
    { method: "GET", path: `/v1/backups/archives/${created.id}` },
    async (client) =>
      decodeNativeBackupArchive(
        await new Backups(client).getArchive({ archiveId: created.id }),
        { ...archiveExpected, archiveId: created.id },
      ),
  );
}

async function restorationRoundtrip(
  transport: ReceiptTransport,
  completed: NativeBackupArchiveReceipt,
) {
  const queued = await transport.runStep(
    { method: "POST", path: "/v1/backups/restoration" },
    async (client) =>
      decodeNativeBackupRestoration(
        await new Backups(client).createRestoration({
          archiveId: completed.id,
          services: [BackupServices.Tablesdb],
          newResourceId: requestedDestinationResourceId,
        }),
        { archive: completed, requestedDestinationResourceId },
      ),
  );
  return transport.runStep(
    { method: "GET", path: `/v1/backups/restorations/${queued.id}` },
    async (client) =>
      decodeNativeBackupRestoration(
        await new Backups(client).getRestoration({ restorationId: queued.id }),
        {
          archive: completed,
          requestedDestinationResourceId,
          restorationId: queued.id,
        },
      ),
  );
}

describe("native backup receipt identity chain", () => {
  it("admits actual SDK response descriptors through a network-disabled roundtrip", async () => {
    const { agent, transport } = nativeReceiptFixture();
    try {
      const completed = await archiveRoundtrip(transport);
      const observed = await restorationRoundtrip(transport, completed);
      expect(observed.progress).toBe("completed");
      expect(transport.snapshot()).toMatchObject({
        steps: 4,
        requests: 4,
        sealed: false,
        activeStep: false,
      });
      agent.assertNoPendingInterceptors();
    } finally {
      await transport.close();
    }
  });

  it("captures creation IDs and binds every later observation to them", () => {
    const created = decodeNativeBackupArchive(
      archive({
        status: "pending",
        size: 0,
        startedAt: "",
        migrationId: "",
      }),
      archiveExpected,
    );
    expect(created).toMatchObject({
      id: archiveId,
      progress: "pending",
      pollingAllowed: true,
    });
    const completed = decodeNativeBackupArchive(archive(), {
      ...archiveExpected,
      archiveId: created.id,
      migrationId,
    });
    const queued = decodeNativeBackupRestoration(
      restoration({
        status: "pending",
        startedAt: "",
        migrationId: "",
      }),
      { archive: completed, requestedDestinationResourceId },
    );
    const observed = decodeNativeBackupRestoration(restoration(), {
      archive: completed,
      requestedDestinationResourceId,
      restorationId: queued.id,
      migrationId: "invented_restore_migration",
    });
    expect(observed).toMatchObject({
      id: restorationId,
      archiveId,
      sourceResourceId,
      requestedDestinationResourceId,
      progress: "completed",
      terminal: true,
      pollingAllowed: false,
      operationRetryAllowed: false,
      destinationEvidence: "request_only",
      requiredIndependentEvidence: NATIVE_BACKUP_DESTINATION_EVIDENCE,
    });
  });

  it.each([
    ["archive ID", { archiveId: "different_archive" }],
    ["migration ID", { migrationId: "different_migration" }],
    ["source ID", { sourceResourceId: "different_source" }],
    ["documented resource type", { expectedResourceType: "different_type" }],
  ])("refuses a changed captured %s", (_name, changed) => {
    invalid(() =>
      decodeNativeBackupArchive(archive(), { ...archiveExpected, ...changed }),
    );
  });

  it.each([
    ["archive", { archiveId: "different_archive" }],
    ["restoration", { $id: "different_restore" }],
    ["migration", { migrationId: "different_migration" }],
  ])("refuses a restoration with a different %s join", (_name, changed) => {
    invalid(() => restore(restoration(changed)));
  });

  it("permits absent resourceType until a documented expected type is supplied", () => {
    const value = archive();
    delete value.resourceType;
    expect(
      decodeNativeBackupArchive(value, { sourceResourceId }).resourceType,
    ).toBeNull();
    invalid(() => decodeNativeBackupArchive(value, archiveExpected));
  });

  it("refuses an unfinished source archive or an in-place request", () => {
    const pending = decodeNativeBackupArchive(
      archive({ status: "pending" }),
      archiveExpected,
    );
    invalid(() =>
      decodeNativeBackupRestoration(restoration(), {
        archive: pending,
        requestedDestinationResourceId,
      }),
    );
    invalid(() =>
      decodeNativeBackupRestoration(restoration(), {
        archive: decodeNativeBackupArchive(archive(), archiveExpected),
        requestedDestinationResourceId: sourceResourceId,
      }),
    );
  });

  it.each([
    { status: "failed" as const },
    { terminal: false },
    { pollingAllowed: true },
  ])("refuses inconsistent completed-archive evidence %j", (change) => {
    const completed = decodeNativeBackupArchive(archive(), archiveExpected);
    invalid(() =>
      decodeNativeBackupRestoration(restoration(), {
        archive: { ...completed, ...change },
        requestedDestinationResourceId,
      }),
    );
  });

  it("freezes captured evidence and all nested summaries", () => {
    const first = decodeNativeBackupArchive(archive(), archiveExpected);
    const second = restore(restoration());
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.resources)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.options)).toBe(true);
    expect(Object.isFrozen(second.resources)).toBe(true);
    expect(Object.isFrozen(second.requiredIndependentEvidence)).toBe(true);
    expect(() => Object.assign(first, { id: "changed" })).toThrow(TypeError);
  });

  it.each(["", "_invalid", "x".repeat(37), "bad/id"])(
    "refuses invalid trusted IDs %j",
    (id) => {
      invalid(() =>
        decodeNativeBackupArchive(archive(), { sourceResourceId: id }),
      );
      invalid(() =>
        decodeNativeBackupArchive(archive(), {
          ...archiveExpected,
          archiveId: id,
        }),
      );
      invalid(() =>
        decodeNativeBackupRestoration(restoration(), {
          archive: decodeNativeBackupArchive(archive(), archiveExpected),
          requestedDestinationResourceId: id,
        }),
      );
    },
  );
});

describe("native backup states", () => {
  const stateDecoders = {
    archive: (status: string) =>
      decodeNativeBackupArchive(archive({ status }), archiveExpected),
    restoration: (status: string) => restore(restoration({ status })),
  };
  it.each([
    [
      "archive",
      {
        status: "pending",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "archive",
      {
        status: "processing",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "archive",
      {
        status: "uploading",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "restoration",
      {
        status: "pending",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "restoration",
      {
        status: "downloading",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "restoration",
      {
        status: "processing",
        progress: "pending",
        pollingAllowed: true,
        terminal: false,
      },
    ],
    [
      "archive",
      {
        status: "completed",
        progress: "completed",
        pollingAllowed: false,
        terminal: true,
      },
    ],
    [
      "archive",
      {
        status: "failed",
        progress: "failed",
        pollingAllowed: false,
        terminal: true,
      },
    ],
    [
      "archive",
      {
        status: "skipped",
        progress: "skipped",
        pollingAllowed: false,
        terminal: true,
      },
    ],
    [
      "restoration",
      {
        status: "completed",
        progress: "completed",
        pollingAllowed: false,
        terminal: true,
      },
    ],
    [
      "restoration",
      {
        status: "failed",
        progress: "failed",
        pollingAllowed: false,
        terminal: true,
      },
    ],
  ] as const)(
    "%s state %j preserves progress, polling and no operation retry",
    (kind, expected) => {
      expect(stateDecoders[kind](expected.status)).toMatchObject({
        ...expected,
        operationRetryAllowed: false,
      });
    },
  );

  it.each(["unknown", "COMPLETED", "", null, 1])(
    "refuses unknown status %j",
    (status) => {
      invalid(() =>
        decodeNativeBackupArchive(archive({ status }), archiveExpected),
      );
      invalid(() => restore(restoration({ status })));
    },
  );

  it("refuses service-specific states on the other receipt", () => {
    invalid(() =>
      decodeNativeBackupArchive(
        archive({ status: "downloading" }),
        archiveExpected,
      ),
    );
    invalid(() => restore(restoration({ status: "skipped" })));
    invalid(() => restore(restoration({ status: "uploading" })));
  });
});

describe("bounded documented metadata", () => {
  it.each([
    "$id",
    "$createdAt",
    "$updatedAt",
    "policyId",
    "startedAt",
    "migrationId",
    "services",
    "resources",
  ])("requires metadata %s", (field) => {
    const first = archive();
    const second = restoration();
    delete first[field];
    delete second[field];
    invalid(() => decodeNativeBackupArchive(first, archiveExpected));
    invalid(() => restore(second));
  });

  it.each([null, [], 7, "receipt", new Date()])(
    "refuses malformed envelope %j",
    (value) => {
      invalid(() => decodeNativeBackupArchive(value, archiveExpected));
      invalid(() => restore(value));
    },
  );

  it("refuses unknown fields and accessors without invoking them", () => {
    invalid(() =>
      decodeNativeBackupArchive(
        archive({ inventedStatus: "completed" }),
        archiveExpected,
      ),
    );
    invalid(() =>
      restore(restoration({ newResourceId: requestedDestinationResourceId })),
    );
    const value = archive();
    Object.defineProperty(value, "size", {
      enumerable: true,
      get: () => {
        throw new Error("must not run");
      },
    });
    invalid(() => decodeNativeBackupArchive(value, archiveExpected));
  });

  it("allows only the exact SDK stringifier descriptor and never invokes it", () => {
    const value = archive();
    Object.defineProperty(value, "toString", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: () => {
        throw new Error("must not run");
      },
    });
    expect(decodeNativeBackupArchive(value, archiveExpected).id).toBe(
      archiveId,
    );
    for (const descriptor of [
      {
        enumerable: true,
        configurable: true,
        writable: true,
        value: () => "bad",
      },
      {
        enumerable: false,
        configurable: false,
        writable: true,
        value: () => "bad",
      },
      {
        enumerable: false,
        configurable: true,
        writable: false,
        value: () => "bad",
      },
      {
        enumerable: false,
        configurable: true,
        writable: true,
        value: "not a function",
      },
      {
        enumerable: false,
        configurable: true,
        get: () => {
          throw new Error("must not run");
        },
      },
    ]) {
      const malformed = archive();
      Object.defineProperty(malformed, "toString", descriptor);
      invalid(() => decodeNativeBackupArchive(malformed, archiveExpected));
    }
    const other = archive();
    Object.defineProperty(other, "unknownHidden", {
      value: () => "bad",
      enumerable: false,
    });
    invalid(() => decodeNativeBackupArchive(other, archiveExpected));
  });

  it.each([
    [],
    ["databases"],
    ["tablesdb", "tablesdb"],
    ["tablesdb", "storage"],
    "tablesdb",
  ])("requires exactly the TablesDB service %j", (services) => {
    invalid(() =>
      decodeNativeBackupArchive(archive({ services }), archiveExpected),
    );
    invalid(() => restore(restoration({ services })));
  });

  it.each([
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-10-18",
    "2026-10-18T24:00:00Z",
    "2026-10-18T12:00:00",
    "",
    null,
  ])("refuses invalid required timestamp %j", (time) => {
    invalid(() =>
      decodeNativeBackupArchive(archive({ $createdAt: time }), archiveExpected),
    );
    invalid(() => restore(restoration({ $updatedAt: time })));
    invalid(() => restore(restoration({ startedAt: time })));
  });

  it("accepts real leap days, ISO offsets and fractional seconds without imposing time order", () => {
    expect(
      decodeNativeBackupArchive(
        archive({
          $createdAt: "2024-02-29T23:59:59.123456789Z",
          $updatedAt: "2024-02-28T00:00:00+05:30",
        }),
        archiveExpected,
      ).createdAt,
    ).toBe("2024-02-29T23:59:59.123456789Z");
  });

  it("permits empty pre-start metadata only in pending receipts", () => {
    expect(
      decodeNativeBackupArchive(
        archive({ status: "pending", startedAt: "", migrationId: "" }),
        archiveExpected,
      ).startedAt,
    ).toBe("");
    for (const status of ["processing", "completed", "failed", "skipped"]) {
      invalid(() =>
        decodeNativeBackupArchive(
          archive({ status, startedAt: "" }),
          archiveExpected,
        ),
      );
      invalid(() =>
        decodeNativeBackupArchive(
          archive({ status, migrationId: "" }),
          archiveExpected,
        ),
      );
    }
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, "12", null])(
    "refuses unsafe archive size %j",
    (size) => {
      invalid(() =>
        decodeNativeBackupArchive(archive({ size }), archiveExpected),
      );
    },
  );

  it.each([0, Number.MAX_SAFE_INTEGER])(
    "accepts safe nonnegative size %s",
    (size) => {
      expect(
        decodeNativeBackupArchive(archive({ size }), archiveExpected).size,
      ).toBe(size);
    },
  );

  it("requires source identity and validates optional resource type bounds", () => {
    const value = archive();
    delete value.resourceId;
    invalid(() => decodeNativeBackupArchive(value, archiveExpected));
    invalid(() =>
      decodeNativeBackupArchive(archive({ resourceType: "x".repeat(65) }), {
        sourceResourceId,
      }),
    );
    invalid(() =>
      decodeNativeBackupArchive(archive({ resourceType: 1 }), {
        sourceResourceId,
      }),
    );
  });
});

describe("opaque native fields", () => {
  it.each([
    "",
    "not JSON",
    '{"newResourceId":"unrelated"}',
    '["any","shape"]',
    "原始文字",
  ])("hashes options as bytes without interpreting %j", (options) => {
    const result = restore(restoration({ options }));
    expect(result.options).toEqual({
      bytes: Buffer.byteLength(options, "utf8"),
      sha256: createHash("sha256").update(options).digest("hex"),
    });
    expect(result.requestedDestinationResourceId).toBe(
      requestedDestinationResourceId,
    );
    expect(result.destinationEvidence).toBe("request_only");
    expect(result).not.toHaveProperty("newResourceId");
  });

  it("retains only bounded resource-array evidence without interpreting its strings", () => {
    const resources = ["", "database:unrelated", "{not-json}", "資源"];
    expect(restore(restoration({ resources })).resources).toEqual({
      count: resources.length,
      bytes: Buffer.byteLength(JSON.stringify(resources)),
      sha256: createHash("sha256")
        .update(JSON.stringify(resources))
        .digest("hex"),
    });
  });

  it("accepts limits and refuses excess options, resources and multibyte data", () => {
    expect(
      restore(
        restoration({
          options: "x".repeat(NATIVE_BACKUP_RECEIPT_LIMITS.optionsBytes),
        }),
      ).options.bytes,
    ).toBe(16384);
    invalid(() => restore(restoration({ options: "x".repeat(16385) })));
    invalid(() => restore(restoration({ options: "界".repeat(5462) })));
    invalid(() => restore(restoration({ options: {} })));
    const resources = Array.from({ length: 32 }, () => "x".repeat(1024));
    expect(restore(restoration({ resources })).resources.count).toBe(32);
    invalid(() => restore(restoration({ resources: [...resources, "extra"] })));
    invalid(() => restore(restoration({ resources: ["x".repeat(1025)] })));
    invalid(() => restore(restoration({ resources: [null] })));
    invalid(() => restore(restoration({ resources: new Array(1) })));
    invalid(() => restore(restoration({ resources: "opaque" })));
    invalid(() =>
      restore(
        restoration({
          resources: Array.from({ length: 32 }, () => "\u0000".repeat(1024)),
        }),
      ),
    );
  });
});
