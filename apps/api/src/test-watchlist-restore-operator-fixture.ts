import { AppwriteException, Query } from "node-appwrite";
import { MockAgent, Response } from "undici";
import { expect } from "vitest";
import { createRestoreOperatorTransport } from "./restore-operator-transport";
import { AtomicStore } from "./test-appwrite-atomic-store";
import { WATCHLIST_RESTORE_SOURCE_CREATES } from "./watchlist-restore-operator-plan";
import {
  WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF as BUILD,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID as FUNCTION,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS as SETTINGS,
} from "./watchlist-restore-operator-function";
import {
  WATCHLIST_RESTORE_PROOF_TARGET as TARGET,
  type WatchlistRestoreProofPhase,
  type WatchlistRestoreProofSide,
} from "./watchlist-restore-proof-data";
import {
  runWatchlistRestoreProof,
  type WatchlistRestoreProofFactory,
  type WatchlistRestoreProofReport,
} from "./watchlist-storage-restore-proof";

type Row = Record<string, unknown>;
const TIME = "2026-10-18T00:00:00.000Z";
export const DEPLOYMENT = "invented-fixed-deployment";
export const ARCHIVE = "invented_archive_1";
export const RESTORATION = "invented_restoration_1";
export const KEY = "invented-integration-key";
const JSON_HEADERS = { "content-type": "application/json" };
class OwnedMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}

function schema(side: WatchlistRestoreProofSide) {
  const databaseId =
    side === "source" ? TARGET.sourceDatabaseId : TARGET.restoredDatabaseId;
  const table = (tableId: "watchlists" | "receipts") => ({
    $id: tableId,
    databaseId,
    name:
      tableId === "watchlists"
        ? "Watchlist qualification"
        : "Watchlist qualification receipts",
    $createdAt: TIME,
    $updatedAt: TIME,
    enabled: true,
    rowSecurity: true,
    $permissions: [],
    indexes: [],
    columns: WATCHLIST_RESTORE_SOURCE_CREATES.flatMap((operation) => {
      const params = operation.params;
      if (!("key" in params) || params.tableId !== tableId) return [];
      const column = Object.fromEntries(
        Object.entries(params).filter(
          ([key]) => !["databaseId", "tableId"].includes(key),
        ),
      );
      return [
        {
          ...column,
          type: operation.path.split("/").at(-1),
          status: "available",
          error: "",
          default: null,
          $createdAt: TIME,
          $updatedAt: TIME,
        },
      ];
    }),
    bytesMax: 0,
    bytesUsed: 500,
  });
  const watchlists = table("watchlists"),
    receipts = table("receipts");
  return {
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
    },
    watchlists,
    receipts,
    tables: { total: 2, tables: [watchlists, receipts] },
  };
}
function functionMetadata() {
  const { functionId, ...settings } = SETTINGS;
  return {
    ...structuredClone(settings),
    $id: functionId,
    live: true,
    deploymentId: DEPLOYMENT,
    vars: [],
    providerSilentMode: false,
    $createdAt: TIME,
    $updatedAt: TIME,
  };
}
function deployment(status: string) {
  return {
    $id: DEPLOYMENT,
    resourceId: FUNCTION,
    resourceType: "functions",
    entrypoint: "main.js",
    activate: false,
    status,
    sourceSize: 246893,
    buildSize: 1176617,
    totalSize: 1423510,
    providerRepositoryName: "",
    providerCommitHash: "",
  };
}
function archive(status: string) {
  return {
    $id: ARCHIVE,
    $createdAt: TIME,
    $updatedAt: TIME,
    policyId: "",
    size: 1234,
    status,
    startedAt: TIME,
    migrationId: "invented_archive_migration",
    services: ["tablesdb"],
    resources: ["opaque source description"],
    resourceId: TARGET.sourceDatabaseId,
    resourceType: "database",
  };
}
function restoration(status: string) {
  return {
    $id: RESTORATION,
    $createdAt: TIME,
    $updatedAt: TIME,
    policyId: "",
    archiveId: ARCHIVE,
    status,
    startedAt: TIME,
    migrationId: "invented_restore_migration",
    services: ["tablesdb"],
    resources: ["opaque restoration description"],
    options: "opaque provider options",
  };
}
function proofFactory(store: AtomicStore): WatchlistRestoreProofFactory {
  return () => {
    const start = store.calls.length;
    let closed = false,
      lastStatus: number | null = null;
    const observed = async <T>(action: () => Promise<T>, status = 200) => {
      try {
        const value = await action();
        lastStatus = status;
        return value;
      } catch (error) {
        lastStatus = error instanceof AppwriteException ? error.code : null;
        throw error;
      }
    };
    return {
      newStore: () => ({
        getRow: (input) =>
          observed(async () => {
            if (
              input.databaseId === TARGET.restoredDatabaseId &&
              ![...store.rows.values()].some(
                (row) => row.$databaseId === input.databaseId,
              )
            ) {
              store.calls.push({
                operation: "getRow",
                input: structuredClone(input),
              });
              throw new AppwriteException(
                "Invented missing database",
                404,
                "database_not_found",
              );
            }
            return store.getRow(input);
          }),
        createTransaction: (input) =>
          observed(() => store.createTransaction(input), 201),
        createRow: (input) => observed(() => store.createRow(input), 201),
        updateRow: (input) => observed(() => store.updateRow(input)),
        incrementRowColumn: (input) =>
          observed(() => store.incrementRowColumn(input)),
        updateTransaction: (input) =>
          observed(() => store.updateTransaction(input)),
      }),
      snapshot: () => ({
        requests: store.calls.length - start,
        lastStatus,
        closed,
      }),
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    };
  };
}
async function bytes(body: unknown) {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>)
    chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export interface OfflineRequest {
  method: string;
  path: string;
  body: unknown;
  response: unknown;
}
interface OfflineReply {
  method: "GET" | "POST" | "PATCH";
  path: string;
  result: Record<string, unknown> | (() => unknown);
  status?: number;
  query?: Record<string, string>;
  inspectBody?: (
    body: unknown,
    headers: Record<string, string>,
  ) => void | Promise<void>;
}
type SourceCreate = (typeof WATCHLIST_RESTORE_SOURCE_CREATES)[number];
function sourceCreateBody(operation: SourceCreate) {
  return Object.fromEntries(
    Object.entries(operation.params).filter(([key]) => {
      if (key === "databaseId") return operation.sdkMethod === "create";
      if (key === "tableId") return operation.sdkMethod === "createTable";
      return true;
    }),
  );
}
function listQuery(limit: number) {
  return { "queries[0]": Query.limit(limit), total: "true" };
}

class OfflineProvider {
  readonly agent = new OwnedMockAgent();
  readonly origin = new URL(TARGET.endpoint).origin;
  readonly pool = this.agent.get(this.origin);
  readonly store = new AtomicStore();
  readonly factory = proofFactory(this.store);
  readonly requests: OfflineRequest[] = [];
  readonly reports = new Map<
    WatchlistRestoreProofPhase,
    WatchlistRestoreProofReport
  >();
  readonly waits: number[] = [];
  readonly errors: unknown[] = [];
  archived: Row[] = [];
  sourceBaseline: Row[] = [];
  restoredBaseline: Row[] = [];
  uploaded: Buffer | undefined;

  constructor(readonly corruptRestoredReceipt: boolean) {
    this.agent.disableNetConnect();
  }
  rows(databaseId: string) {
    return structuredClone(
      [...this.store.rows.values()].filter(
        (row) => row.$databaseId === databaseId,
      ),
    );
  }
  reply(options: OfflineReply) {
    this.pool
      .intercept({
        method: options.method,
        path: (value) =>
          new URL(value, this.origin).pathname === "/v1" + options.path,
      })
      .reply(
        options.status ?? 200,
        async (request) => {
          try {
            const url = new URL(request.path, this.origin);
            expect(Object.fromEntries(url.searchParams)).toEqual(
              options.query ?? {},
            );
            const headers = Object.fromEntries(
              Object.entries(request.headers as Record<string, string>).map(
                ([key, value]) => [key.toLowerCase(), value],
              ),
            );
            expect(headers["x-appwrite-project"]).toBe(TARGET.project);
            expect(headers["x-appwrite-key"]).toBe(KEY);
            const raw =
              options.method === "GET" ? undefined : await bytes(request.body);
            const body: unknown =
              raw && headers["content-type"]?.startsWith("application/json")
                ? JSON.parse(raw.toString("utf8"))
                : raw;
            await options.inspectBody?.(body, headers);
            const response: unknown =
              typeof options.result === "function"
                ? await options.result()
                : options.result;
            this.requests.push({
              method: options.method,
              path: url.pathname,
              body,
              response: structuredClone(response),
            });
            return JSON.stringify(response);
          } catch (error) {
            this.errors.push(error);
            return JSON.stringify({ fixtureFailure: true });
          }
        },
        { headers: JSON_HEADERS },
      );
  }
  absent(path: string, type: string) {
    this.reply({
      method: "GET",
      path,
      result: { message: "Invented absent resource", code: 404, type },
      status: 404,
    });
  }
  schemaReplies(side: WatchlistRestoreProofSide, complete: boolean) {
    const data = schema(side),
      path = "/tablesdb/" + data.database.$id;
    this.reply({ method: "GET", path, result: data.database });
    if (complete)
      this.reply({
        method: "GET",
        path: path + "/tables",
        result: data.tables,
        query: listQuery(3),
      });
    this.reply({
      method: "GET",
      path: path + "/tables/watchlists",
      result: data.watchlists,
    });
    this.reply({
      method: "GET",
      path: path + "/tables/receipts",
      result: data.receipts,
    });
  }
  rowReplies(side: WatchlistRestoreProofSide) {
    const databaseId =
      side === "source" ? TARGET.sourceDatabaseId : TARGET.restoredDatabaseId;
    for (const tableId of ["watchlists", "receipts"])
      this.reply({
        method: "GET",
        path: `/tablesdb/${databaseId}/tables/${tableId}/rows`,
        result: () => {
          const found = this.rows(databaseId).filter(
            (row) => row.$tableId === tableId,
          );
          return { total: found.length, rows: found };
        },
        query: listQuery(4),
      });
  }
  phaseReply(phase: WatchlistRestoreProofPhase) {
    this.reply({
      method: "POST",
      path: `/functions/${FUNCTION}/executions`,
      result: async () => {
        const report = await runWatchlistRestoreProof(
          phase,
          BUILD,
          this.factory,
        );
        expect(report.outcome).toBe("passed");
        this.reports.set(phase, report);
        if (phase === "seed")
          this.sourceBaseline = this.rows(TARGET.sourceDatabaseId);
        return {
          $id: "invented-execution-" + phase,
          resourceId: FUNCTION,
          resourceType: "functions",
          deploymentId: DEPLOYMENT,
          trigger: "http",
          status: "completed",
          requestMethod: "POST",
          requestPath: "/proof/" + phase,
          responseStatusCode: 200,
          responseBody: JSON.stringify(report),
          requestHeaders: [],
          responseHeaders: [],
          logs: "",
          errors: "",
          duration: 0.05,
        };
      },
      status: 201,
      inspectBody: (body) =>
        expect(body).toEqual({
          body: "",
          async: false,
          path: "/proof/" + phase,
          method: "POST",
          headers: {},
        }),
    });
  }
  registerPreflight() {
    this.absent("/tablesdb/" + TARGET.sourceDatabaseId, "database_not_found");
    this.absent("/tablesdb/" + TARGET.restoredDatabaseId, "database_not_found");
    this.absent("/functions/" + FUNCTION, "function_not_found");
    this.reply({
      method: "GET",
      path: "/functions/runtimes",
      result: { total: 1, runtimes: [{ $id: "node-24" }] },
    });
    for (const [type, slug] of [
      ["builds", "s-2vcpu-2gb"],
      ["runtimes", "s-0.5vcpu-512mb"],
    ] as const)
      this.reply({
        method: "GET",
        path: "/functions/specifications",
        result: { total: 1, specifications: [{ slug, enabled: true }] },
        query: { type },
      });
  }
  registerSource() {
    for (const operation of WATCHLIST_RESTORE_SOURCE_CREATES) {
      const params = operation.params;
      this.reply({
        method: "POST",
        path: operation.path,
        result:
          "key" in params
            ? { key: params.key, status: "processing", error: "" }
            : { $id: "tableId" in params ? params.tableId : params.databaseId },
        status: 201,
        inspectBody: (body) =>
          expect(body).toEqual(sourceCreateBody(operation)),
      });
    }
    this.schemaReplies("source", false);
    this.reply({
      method: "GET",
      path: `/tablesdb/${TARGET.sourceDatabaseId}/tables`,
      result: schema("source").tables,
      query: listQuery(3),
    });
    this.rowReplies("source");
  }
  async inspectUpload(body: unknown, headers: Record<string, string>) {
    expect(headers["content-type"]).toMatch(
      /^multipart\/form-data; boundary=/u,
    );
    const form = await new Response(body as Buffer, {
      headers: { "content-type": headers["content-type"]! },
    }).formData();
    const code = form.get("code") as { arrayBuffer(): Promise<ArrayBuffer> };
    this.uploaded = Buffer.from(await code.arrayBuffer());
    expect(form.get("activate")).toBe("false");
    expect(form.get("entrypoint")).toBe("main.js");
    expect(form.get("commands")).toBe("node --check main.js");
  }
  registerFunction() {
    this.reply({
      method: "POST",
      path: "/functions",
      result: functionMetadata(),
      status: 201,
      inspectBody: (body) => expect(body).toEqual(SETTINGS),
    });
    this.reply({
      method: "POST",
      path: `/functions/${FUNCTION}/deployments`,
      result: deployment("building"),
      status: 201,
      inspectBody: (body, headers) => this.inspectUpload(body, headers),
    });
    this.reply({
      method: "GET",
      path: `/functions/${FUNCTION}/deployments/${DEPLOYMENT}`,
      result: deployment("ready"),
    });
    this.reply({
      method: "PATCH",
      path: `/functions/${FUNCTION}/deployment`,
      result: functionMetadata(),
      inspectBody: (body) => expect(body).toEqual({ deploymentId: DEPLOYMENT }),
    });
    this.reply({
      method: "GET",
      path: "/functions/" + FUNCTION,
      result: functionMetadata(),
    });
  }
  simulateRestore() {
    // This copies invented rows. It does not model or establish a provider restore.
    for (const original of this.archived) {
      const row: Row = {
        ...structuredClone(original),
        $databaseId: TARGET.restoredDatabaseId,
      };
      this.store.rows.set(
        JSON.stringify([row.$databaseId, row.$tableId, row.$id]),
        row,
      );
    }
    if (this.corruptRestoredReceipt) {
      const receipt = [...this.store.rows.values()].find(
        (row) =>
          row.$databaseId === TARGET.restoredDatabaseId &&
          row.$tableId === "receipts",
      )!;
      receipt.requestDigest = "0".repeat(64);
    }
    this.restoredBaseline = this.rows(TARGET.restoredDatabaseId);
    return restoration("processing");
  }
  registerNativeRestore() {
    this.reply({
      method: "POST",
      path: "/backups/archives",
      status: 201,
      result: () => {
        this.archived = this.rows(TARGET.sourceDatabaseId);
        return archive("processing");
      },
      inspectBody: (body) =>
        expect(body).toEqual({
          services: ["tablesdb"],
          resourceId: TARGET.sourceDatabaseId,
        }),
    });
    this.reply({
      method: "GET",
      path: "/backups/archives/" + ARCHIVE,
      result: archive("completed"),
    });
    this.absent("/tablesdb/" + TARGET.restoredDatabaseId, "database_not_found");
    this.reply({
      method: "POST",
      path: "/backups/restoration",
      status: 201,
      result: () => this.simulateRestore(),
      inspectBody: (body) =>
        expect(body).toEqual({
          archiveId: ARCHIVE,
          services: ["tablesdb"],
          newResourceId: TARGET.restoredDatabaseId,
          newResourceName: "Watchlist restored qualification",
        }),
    });
    this.reply({
      method: "GET",
      path: "/backups/restorations/" + RESTORATION,
      result: restoration("completed"),
    });
  }
  registerQualification() {
    this.phaseReply("preflight");
    this.phaseReply("seed");
    this.schemaReplies("source", true);
    this.rowReplies("source");
    this.registerNativeRestore();
    this.schemaReplies("restored", true);
    this.rowReplies("restored");
    this.phaseReply("verify-restored");
    this.phaseReply("verify-source");
    this.rowReplies("source");
    this.rowReplies("restored");
  }
}

/** Real SDK and transport; invented provider storage and native restore simulation only. */
export function watchlistRestoreOperatorFixture(
  options: { corruptRestoredReceipt?: boolean } = {},
) {
  const provider = new OfflineProvider(options.corruptRestoredReceipt ?? false);
  provider.registerPreflight();
  provider.registerSource();
  provider.registerFunction();
  provider.registerQualification();
  const transport = createRestoreOperatorTransport({
    endpoint: TARGET.endpoint,
    projectId: TARGET.project,
    key: KEY,
    dispatcher: provider.agent,
  });
  return {
    agent: provider.agent,
    transport,
    store: provider.store,
    requests: provider.requests,
    reports: provider.reports,
    waits: provider.waits,
    errors: provider.errors,
    wait: (ms: number) => {
      provider.waits.push(ms);
      return Promise.resolve();
    },
    get sourceBaseline() {
      return provider.sourceBaseline;
    },
    get restoredBaseline() {
      return provider.restoredBaseline;
    },
    get uploaded() {
      return provider.uploaded;
    },
    rows: (databaseId: string) => provider.rows(databaseId),
  };
}
