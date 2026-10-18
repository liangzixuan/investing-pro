import { Client } from "node-appwrite";
import type * as ArtifactModule from "./restore-operator-artifact";
import type * as FunctionModule from "./watchlist-restore-operator-function";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RestoreOperatorIntent,
  RestoreOperatorJournal,
} from "./restore-operator-journal";
import { RestoreOperatorJournalError } from "./restore-operator-journal";
import {
  RestoreOperatorTransportError,
  type createRestoreOperatorTransport,
} from "./restore-operator-transport";
import { WATCHLIST_RESTORE_PROOF_TARGET as TARGET } from "./watchlist-restore-proof-data";
import { WATCHLIST_RESTORE_ARCHIVE } from "./restore-operator-artifact";
import {
  createWatchlistRestoreOperator,
  WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256,
  type WatchlistRestoreOperatorOptions,
} from "./watchlist-restore-operator";
import {
  WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID as FUNCTION,
} from "./watchlist-restore-operator-function";

// These tests isolate orchestration. Actual artifact, receipt, schema and phase
// admissions each have their own strict tests; SDK service methods still run here.
vi.mock("./restore-operator-artifact", async (importOriginal) => {
  const actual = await importOriginal<typeof ArtifactModule>();
  return {
    ...actual,
    admitRestoreOperatorArtifact: vi.fn((bytes: Uint8Array) =>
      Buffer.from(bytes),
    ),
  };
});
vi.mock("./watchlist-restore-operator-evidence", () => ({
  inspectWatchlistRestoreSchema: vi.fn(() => "available"),
  inspectWatchlistRestoreRows: vi.fn(
    (input: { side: "source" | "restored"; stage: string }) => {
      if (input.stage === "empty") return [];
      return fingerprints(
        input.side,
        input.stage === "final" && input.side === "restored",
      );
    },
  ),
}));
vi.mock("./watchlist-restore-operator-function", async (importOriginal) => {
  const actual = await importOriginal<typeof FunctionModule>();
  return {
    ...actual,
    inspectRestoreFunction: vi.fn(),
    inspectRestoreDeployment: vi.fn(
      (value: { $id: string; status: string }) => ({
        id: value.$id,
        status: value.status === "ready" ? "ready" : "pending",
      }),
    ),
    decodeRestoreExecution: vi.fn((value: { phase: string }) => ({
      rowFingerprints:
        value.phase === "preflight"
          ? []
          : fingerprints(
              value.phase === "verify-restored" ? "restored" : "source",
              value.phase === "verify-restored",
            ),
    })),
  };
});
import {
  inspectWatchlistRestoreSchema,
  inspectWatchlistRestoreRows,
} from "./watchlist-restore-operator-evidence";
import { decodeRestoreExecution } from "./watchlist-restore-operator-function";

function fingerprints(side: "source" | "restored", final = false) {
  return [
    "current",
    "receipt1",
    "receipt2",
    ...(final ? ["receipt3"] : []),
  ].map((rowId, index) => ({
    side,
    rowId,
    sha256: side + (final ? "final" : "") + index,
    applicationSha256:
      "application" + (final && rowId === "current" ? "3" : "") + index,
  }));
}
const DEPLOYMENT = "invented-deployment",
  ARCHIVE = "invented-archive",
  RESTORATION = "invented-restoration";
function nativeArchive(status = "completed") {
  return {
    $id: ARCHIVE,
    $createdAt: "2026-10-18T00:00:00.000Z",
    $updatedAt: "2026-10-18T00:00:01.000Z",
    policyId: "",
    status,
    startedAt: "2026-10-18T00:00:00.000Z",
    migrationId: "invented-archive-migration",
    services: ["tablesdb"],
    resources: [],
    resourceId: TARGET.sourceDatabaseId,
    resourceType: "database",
    size: 1,
  };
}
function nativeRestoration(status = "completed") {
  return {
    $id: RESTORATION,
    $createdAt: "2026-10-18T00:00:00.000Z",
    $updatedAt: "2026-10-18T00:00:01.000Z",
    policyId: "",
    status,
    startedAt: "2026-10-18T00:00:00.000Z",
    migrationId: "invented-restore-migration",
    services: ["tablesdb"],
    resources: [],
    archiveId: ARCHIVE,
    options: "opaque provider options",
  };
}
interface Faults {
  failRequest?: number;
  failBefore?: number;
  failReceived?: number;
  failConsume?: boolean;
  failFinish?: boolean;
  close?: boolean;
  existingTarget?: boolean;
  archiveStatus?: string;
  restorationStatus?: string;
  keepBuildPending?: boolean;
  buildPendingReads?: number;
  archivePendingReads?: number;
  restorationPendingReads?: number;
  expireAtWait?: boolean;
  abortAtWait?: boolean;
  pendingSchemaBatches?: number;
}
interface OfflineCall {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, unknown>;
}
interface OfflineContext {
  readonly faults: Faults;
  readonly intent: RestoreOperatorIntent;
  readonly controller: AbortController;
  readonly events: string[];
  readonly calls: OfflineCall[];
  readonly receipts: { ordinal: number; result: unknown }[];
  ordinal: number;
  closed: boolean;
  seeded: boolean;
  restored: boolean;
  sourceCreated: boolean;
  functionCreated: boolean;
  now: number;
  buildReads: number;
  archiveReads: number;
  restorationReads: number;
  schemaBatches: number;
}
function fixtureIntent(): RestoreOperatorIntent {
  return {
    attemptId: "invented-attempt",
    controllerRevision: "a".repeat(40),
    reviewedPlanSha256: WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256,
    approvalRecordSha256: "b".repeat(64),
    expiresAt: "2026-10-18T01:00:00.000Z",
    endpoint: TARGET.endpoint,
    projectId: TARGET.project,
    archiveSha256: WATCHLIST_RESTORE_ARCHIVE.sha256,
    buildProof: WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
  };
}
function fixtureContext(faults: Faults): OfflineContext {
  return {
    faults,
    intent: fixtureIntent(),
    controller: new AbortController(),
    events: [],
    calls: [],
    receipts: [],
    ordinal: 0,
    closed: false,
    seeded: false,
    restored: false,
    sourceCreated: false,
    functionCreated: false,
    now: Date.parse("2026-10-18T00:00:00.000Z"),
    buildReads: 0,
    archiveReads: 0,
    restorationReads: 0,
    schemaBatches: 0,
  };
}
function schemaAvailability(context: OfflineContext) {
  const pending = context.faults.pendingSchemaBatches;
  if (pending)
    vi.mocked(inspectWatchlistRestoreSchema).mockImplementation(() =>
      ++context.schemaBatches <= pending ? "pending" : "available",
    );
}
function readAbsence(context: OfflineContext, call: OfflineCall) {
  const resources = [
    {
      path: "/v1/tablesdb/" + TARGET.sourceDatabaseId,
      exists: context.sourceCreated,
      absence: "database_not_found" as const,
    },
    {
      path: "/v1/tablesdb/" + TARGET.restoredDatabaseId,
      exists: context.restored,
      absence: "database_not_found" as const,
    },
    {
      path: "/v1/functions/" + FUNCTION,
      exists: context.functionCreated,
      absence: "function_not_found" as const,
    },
  ];
  const missing = resources.find(
    (resource) => resource.path === call.path && !resource.exists,
  );
  if (!missing) return undefined;
  if (
    call.path === "/v1/tablesdb/" + TARGET.restoredDatabaseId &&
    context.faults.existingTarget
  )
    return { $id: TARGET.restoredDatabaseId };
  throw new RestoreOperatorTransportError(
    "request_failed",
    404,
    missing.absence,
  );
}
function readBuild(context: OfflineContext) {
  return {
    $id: DEPLOYMENT,
    status:
      context.faults.keepBuildPending ||
      ++context.buildReads <= (context.faults.buildPendingReads ?? 0)
        ? "building"
        : "ready",
  };
}
function readArchive(context: OfflineContext) {
  return nativeArchive(
    ++context.archiveReads <= (context.faults.archivePendingReads ?? 0)
      ? "processing"
      : context.faults.archiveStatus,
  );
}
function readRestoration(context: OfflineContext) {
  return nativeRestoration(
    ++context.restorationReads <= (context.faults.restorationPendingReads ?? 0)
      ? "processing"
      : context.faults.restorationStatus,
  );
}
function readInventory(context: OfflineContext, call: OfflineCall) {
  if (call.path.endsWith("/tables"))
    return { total: 2, tables: [{ $id: "watchlists" }, { $id: "receipts" }] };
  if (call.path.endsWith("/rows"))
    return { total: context.seeded ? 1 : 0, rows: [] };
  return { $id: call.params.tableId ?? call.params.databaseId ?? FUNCTION };
}
function readResponse(context: OfflineContext, call: OfflineCall) {
  const responses = new Map<string, () => unknown>([
    [
      "/v1/functions/runtimes",
      () => ({ total: 1, runtimes: [{ $id: "node-24" }] }),
    ],
    [
      "/v1/functions/specifications",
      () => ({
        total: 1,
        specifications: [
          {
            slug:
              call.params.type === "builds" ? "s-2vcpu-2gb" : "s-0.5vcpu-512mb",
            enabled: true,
          },
        ],
      }),
    ],
    ["/v1/backups/archives/" + ARCHIVE, () => readArchive(context)],
    ["/v1/backups/restorations/" + RESTORATION, () => readRestoration(context)],
  ]);
  const response = responses.get(call.path);
  if (response) return response();
  const absence = readAbsence(context, call);
  if (absence) return absence;
  if (call.path.endsWith("/deployments/" + DEPLOYMENT))
    return readBuild(context);
  return readInventory(context, call);
}
function executionResponse(context: OfflineContext, call: OfflineCall) {
  const phase = String(call.params.path).slice("/proof/".length);
  if (phase === "seed") context.seeded = true;
  return { phase };
}
function createResponse(context: OfflineContext, call: OfflineCall) {
  const responses = new Map<string, () => unknown>([
    [
      "/v1/tablesdb",
      () => {
        context.sourceCreated = true;
        return { $id: TARGET.sourceDatabaseId };
      },
    ],
    [
      "/v1/functions",
      () => {
        context.functionCreated = true;
        return { $id: FUNCTION };
      },
    ],
    ["/v1/backups/archives", () => nativeArchive(context.faults.archiveStatus)],
    [
      "/v1/backups/restoration",
      () => {
        context.restored = true;
        return nativeRestoration(context.faults.restorationStatus);
      },
    ],
  ]);
  const response = responses.get(call.path);
  return response?.();
}
function mutationResponse(context: OfflineContext, call: OfflineCall) {
  const created = createResponse(context, call);
  if (created) return created;
  const columns = ["varchar", "bigint", "mediumtext"];
  if (columns.some((type) => call.path.endsWith("/columns/" + type)))
    return { key: call.params.key };
  const responses = new Map<string, () => unknown>([
    ["/tables", () => ({ $id: call.params.tableId })],
    ["/deployments", () => ({ $id: DEPLOYMENT, status: "building" })],
    ["/deployment", () => ({ $id: FUNCTION })],
    ["/executions", () => executionResponse(context, call)],
  ]);
  for (const [suffix, response] of responses)
    if (call.path.endsWith(suffix)) return response();
  throw new Error("Unexpected invented route");
}
class OfflineClient extends Client {
  constructor(private readonly context: OfflineContext) {
    super();
  }
  override call(
    method: string,
    url: URL,
    _headers = {},
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    void _headers;
    const call = { method: method.toUpperCase(), path: url.pathname, params };
    this.context.calls.push(call);
    this.context.events.push("dispatch:" + this.context.ordinal);
    if (this.context.calls.length === this.context.faults.failRequest)
      return Promise.reject(new Error("private provider body"));
    return Promise.resolve().then(() =>
      call.method === "GET"
        ? readResponse(this.context, call)
        : mutationResponse(this.context, call),
    );
  }
}
function fixtureJournal(context: OfflineContext): RestoreOperatorJournal {
  return {
    consume: () => {
      context.events.push("consume");
      return context.faults.failConsume
        ? Promise.reject(new RestoreOperatorJournalError("persistence_failed"))
        : Promise.resolve();
    },
    before: (step) => {
      context.events.push("before:" + step.ordinal);
      expect(step.ordinal).toBe(context.ordinal + 1);
      return context.faults.failBefore === step.ordinal
        ? Promise.reject(new RestoreOperatorJournalError("persistence_failed"))
        : Promise.resolve();
    },
    received: (number, result) => {
      context.events.push("received:" + number);
      context.receipts.push({ ordinal: number, result });
      return context.faults.failReceived === number
        ? Promise.reject(new RestoreOperatorJournalError("persistence_failed"))
        : Promise.resolve();
    },
    finish: () => {
      context.events.push("finish");
      return context.faults.failFinish
        ? Promise.reject(new RestoreOperatorJournalError("persistence_failed"))
        : Promise.resolve();
    },
  };
}
function fixtureTransport(
  context: OfflineContext,
): ReturnType<typeof createRestoreOperatorTransport> {
  const client = new OfflineClient(context)
    .setEndpoint(TARGET.endpoint)
    .setProject(TARGET.project);
  return {
    runStep: async (step, callback) => {
      context.ordinal++;
      const result = await callback(client);
      expect(context.calls.at(-1)?.path).toBe(step.path);
      expect(context.calls.at(-1)?.method).toBe(step.method);
      return result;
    },
    snapshot: () => ({
      steps: context.ordinal,
      requests: context.calls.length,
      lastStatus: 200,
      closed: context.closed,
      sealed: false,
      activeStep: false,
    }),
    close: () => {
      context.events.push("close");
      if (context.faults.close)
        return Promise.reject(
          new RestoreOperatorTransportError("cleanup_failed"),
        );
      context.closed = true;
      return Promise.resolve();
    },
  };
}
function fixtureOptions(
  context: OfflineContext,
  ports: {
    journal: RestoreOperatorJournal;
    transport: ReturnType<typeof createRestoreOperatorTransport>;
  },
): WatchlistRestoreOperatorOptions {
  return {
    intent: context.intent,
    review: {
      controllerRevision: context.intent.controllerRevision,
      reviewedPlanSha256: context.intent.reviewedPlanSha256,
      approvalRecordSha256: context.intent.approvalRecordSha256,
      allowanceAccepted: true,
      retentionAccepted: true,
      maximumAdditionalSpend: 0,
    },
    archive: Buffer.from("invented offline archive"),
    journal: ports.journal,
    key: "invented-key",
    transportFactory: () => {
      context.events.push("transport");
      return ports.transport;
    },
    now: () => context.now,
    signal: context.controller.signal,
    wait: (milliseconds) => {
      expect(milliseconds).toBe(30000);
      context.events.push("wait");
      if (context.faults.expireAtWait)
        context.now = Date.parse(context.intent.expiresAt);
      if (context.faults.abortAtWait) context.controller.abort();
      return Promise.resolve();
    },
  };
}
function fixture(faults: Faults = {}) {
  const context = fixtureContext(faults);
  schemaAvailability(context);
  const journal = fixtureJournal(context),
    transport = fixtureTransport(context);
  const options = fixtureOptions(context, { journal, transport });
  return {
    options,
    events: context.events,
    calls: context.calls,
    intent: context.intent,
    receipts: context.receipts,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inspectWatchlistRestoreSchema).mockReturnValue("available");
});

describe("fixed one-use restore orchestration with offline SDK calls", () => {
  it("orders59 successful minimum calls, intent/results and destination validation before target Save", async () => {
    const f = fixture();
    const result = await createWatchlistRestoreOperator(f.options).run();
    expect(result).toMatchObject({
      outcome: "passed",
      reason: "none",
      steps: 59,
      requests: 59,
      closed: true,
      sourceAndDestinationQualified: true,
    });
    expect(f.events.slice(0, 4)).toEqual([
      "consume",
      "transport",
      "before:1",
      "dispatch:1",
    ]);
    for (let i = 1; i <= 59; i++) {
      expect(f.events.indexOf("before:" + i)).toBeLessThan(
        f.events.indexOf("dispatch:" + i),
      );
      expect(f.events.indexOf("dispatch:" + i)).toBeLessThan(
        f.events.indexOf("received:" + i),
      );
      if (i < 59)
        expect(f.events.indexOf("received:" + i)).toBeLessThan(
          f.events.indexOf("before:" + (i + 1)),
        );
    }
    expect(f.events.slice(-2)).toEqual(["close", "finish"]);
    const restore = f.calls.find(
      (call) => call.path === "/v1/backups/restoration",
    )!;
    expect(restore.params).toMatchObject({
      archiveId: ARCHIVE,
      services: ["tablesdb"],
      newResourceId: TARGET.restoredDatabaseId,
    });
    expect(
      f.calls
        .filter((call) => call.path.endsWith("/executions"))
        .map((call) => call.params.path),
    ).toEqual([
      "/proof/preflight",
      "/proof/seed",
      "/proof/verify-restored",
      "/proof/verify-source",
    ]);
    expect(
      vi
        .mocked(inspectWatchlistRestoreRows)
        .mock.calls.map(([input]) => input.side + ":" + input.stage),
    ).toEqual([
      "source:empty",
      "source:baseline",
      "restored:baseline",
      "source:final",
      "restored:final",
    ]);
    expect(JSON.stringify(result)).not.toContain("invented-key");
  });
  it("does not reuse the same operator", async () => {
    const f = fixture(),
      operator = createWatchlistRestoreOperator(f.options);
    await operator.run();
    const count = f.calls.length;
    expect(await operator.run()).toMatchObject({
      outcome: "stopped",
      reason: "already_used",
    });
    expect(f.calls).toHaveLength(count);
  });
  it("uses all89 admitted requests and690000ms scheduled waits at the finite successful ceiling", async () => {
    const f = fixture({
      pendingSchemaBatches: 5,
      buildPendingReads: 5,
      archivePendingReads: 5,
      restorationPendingReads: 5,
    });
    expect(await createWatchlistRestoreOperator(f.options).run()).toMatchObject(
      { outcome: "passed", steps: 89, requests: 89 },
    );
    expect(f.events.filter((event) => event === "wait")).toHaveLength(23);
    expect(f.calls.filter((call) => call.method === "GET")).toHaveLength(63);
    expect(f.calls.filter((call) => call.method === "POST")).toHaveLength(25);
    expect(f.calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  });
  it("retains original IDs, decoded native receipts and admitted phase evidence before proceeding", async () => {
    const f = fixture();
    expect(
      (await createWatchlistRestoreOperator(f.options).run()).outcome,
    ).toBe("passed");
    const archiveOrdinal =
      f.calls.findIndex((call) => call.path === "/v1/backups/archives") + 1;
    expect(
      f.receipts.find((receipt) => receipt.ordinal === archiveOrdinal)?.result,
    ).toMatchObject({
      originalResult: {
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) as unknown,
      },
      originalMetadata: {
        $id: ARCHIVE,
        migrationId: "invented-archive-migration",
      },
      admission: "accepted",
      admitted: { id: ARCHIVE, sourceResourceId: TARGET.sourceDatabaseId },
    });
    const phaseOrdinal =
      f.calls.findIndex((call) => call.path.endsWith("/executions")) + 1;
    expect(
      f.receipts.find((receipt) => receipt.ordinal === phaseOrdinal)?.result,
    ).toMatchObject({
      admission: "accepted",
      admitted: { rowFingerprints: [] },
    });
    expect(JSON.stringify(f.receipts)).not.toContain("responseBody");
  });
  it.each([
    { endpoint: "https://other.invalid/v1" },
    { projectId: "other-project" },
    { reviewedPlanSha256: "0".repeat(64) },
    { approvalRecordSha256: "0".repeat(64) },
    { controllerRevision: "0".repeat(40) },
    { buildProof: "0".repeat(64) },
    { archiveSha256: "0".repeat(64) },
    { expiresAt: "2026-10-17T00:00:00.000Z" },
  ])(
    "rejects changed or expired admission before consuming intent %j",
    async (patch) => {
      const f = fixture();
      const result = await createWatchlistRestoreOperator({
        ...f.options,
        intent: { ...f.intent, ...patch },
      }).run();
      expect(result).toMatchObject({
        outcome: "stopped",
        reason: "admission",
        requests: 0,
      });
      expect(f.events).toEqual([]);
    },
  );
  it.each([
    { failConsume: true },
    { failBefore: 1 },
    { failReceived: 1 },
    { failBefore: 8 },
    { failReceived: 8 },
    { failFinish: true },
  ])("stops when journal persistence fails %j", async (fault) => {
    const f = fixture(fault),
      result = await createWatchlistRestoreOperator(f.options).run();
    expect(result.outcome).not.toBe("passed");
    expect(result.reason).toBe("journal");
    expect(result.sourceAndDestinationQualified).toBe(false);
    if (fault.failConsume) expect(f.calls).toHaveLength(0);
    if (fault.failBefore) expect(f.calls).toHaveLength(fault.failBefore - 1);
    if (fault.failReceived) expect(f.calls).toHaveLength(fault.failReceived);
  });
  it.each([1, 7, 31, 40, 59])(
    "stops at failed request %i without replay",
    async (failRequest) => {
      const f = fixture({ failRequest }),
        result = await createWatchlistRestoreOperator(f.options).run();
      expect(result.outcome).not.toBe("passed");
      expect(f.calls).toHaveLength(failRequest);
      expect(f.events.filter((event) => event === "close")).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("private provider body");
    },
  );
  it.each([{ expireAtWait: true }, { abortAtWait: true }])(
    "admits no request after interrupted wait %j",
    async (fault) => {
      const f = fixture(fault);
      expect(
        (await createWatchlistRestoreOperator(f.options).run()).outcome,
      ).toBe("uncertain");
      expect(f.events.at(-2)).toBe("close");
      expect(
        f.calls.some((call) =>
          call.path.endsWith("/deployments/" + DEPLOYMENT),
        ),
      ).toBe(false);
    },
  );
  it("stops on an existing target before any mutation", async () => {
    const f = fixture({ existingTarget: true });
    expect(await createWatchlistRestoreOperator(f.options).run()).toMatchObject(
      { outcome: "stopped", mutationMayHaveCommitted: false },
    );
    expect(f.calls).toHaveLength(2);
    expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  });
  it.each(["failed", "skipped"])(
    "stops at initial terminal archive %s without observation or restore",
    async (archiveStatus) => {
      const f = fixture({ archiveStatus });
      expect(
        (await createWatchlistRestoreOperator(f.options).run()).outcome,
      ).toBe("uncertain");
      expect(f.calls.at(-1)?.path).toBe("/v1/backups/archives");
    },
  );
  it("stops at initial terminal restoration without an observation", async () => {
    const f = fixture({ restorationStatus: "failed" });
    expect(
      (await createWatchlistRestoreOperator(f.options).run()).outcome,
    ).toBe("uncertain");
    expect(f.calls.at(-1)?.path).toBe("/v1/backups/restoration");
  });
  it("exhausts a pending build after six reads and never activates", async () => {
    const f = fixture({ keepBuildPending: true });
    expect(
      (await createWatchlistRestoreOperator(f.options).run()).outcome,
    ).toBe("uncertain");
    expect(
      f.calls.filter((call) =>
        call.path.endsWith("/deployments/" + DEPLOYMENT),
      ),
    ).toHaveLength(6);
    expect(f.calls.some((call) => call.method === "PATCH")).toBe(false);
  });
  it("refuses qualification when transport cleanup fails", async () => {
    const f = fixture({ close: true });
    expect(await createWatchlistRestoreOperator(f.options).run()).toMatchObject(
      {
        outcome: "uncertain",
        reason: "cleanup",
        sourceAndDestinationQualified: false,
        closed: false,
      },
    );
    expect(f.events.filter((event) => event === "close")).toHaveLength(1);
  });
  it("stops at source schema failure before function creation", async () => {
    vi.mocked(inspectWatchlistRestoreSchema).mockImplementationOnce(() => {
      throw new Error("invented mismatch");
    });
    const f = fixture();
    expect(
      (await createWatchlistRestoreOperator(f.options).run()).outcome,
    ).toBe("uncertain");
    expect(
      f.calls.some(
        (call) => call.method === "POST" && call.path === "/v1/functions",
      ),
    ).toBe(false);
  });
  it("stops when seed full-row pins differ before archive creation", async () => {
    vi.mocked(decodeRestoreExecution)
      .mockImplementationOnce(() => ({ rowFingerprints: [] }) as never)
      .mockImplementationOnce(
        () =>
          ({
            rowFingerprints: [
              { ...fingerprints("source")[0]!, sha256: "changed" },
            ],
          }) as never,
      );
    const f = fixture();
    expect(
      (await createWatchlistRestoreOperator(f.options).run()).outcome,
    ).toBe("uncertain");
    expect(f.calls.some((call) => call.path === "/v1/backups/archives")).toBe(
      false,
    );
  });
});
