import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import {
  Backups,
  BackupServices,
  type Client,
  ExecutionMethod,
  Functions,
  Query,
  TablesDB,
} from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  decodeNativeBackupArchive,
  decodeNativeBackupRestoration,
  type NativeBackupArchiveReceipt,
} from "./native-backup-receipts";
import {
  admitRestoreOperatorArtifact,
  restoreOperatorEvidenceDigest,
  WATCHLIST_RESTORE_ARCHIVE,
} from "./restore-operator-artifact";
import {
  RestoreOperatorJournalError,
  type RestoreOperatorIntent,
  type RestoreOperatorJournal,
} from "./restore-operator-journal";
import {
  createRestoreOperatorTransport,
  RestoreOperatorTransportError,
  type RestoreOperatorStep,
} from "./restore-operator-transport";
import {
  WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
  WATCHLIST_RESTORE_PROOF_TARGET,
  type WatchlistRestoreProofPhase,
  type WatchlistRestoreProofSide,
} from "./watchlist-restore-proof-data";
import {
  inspectWatchlistRestoreRows,
  inspectWatchlistRestoreSchema,
  type RowFingerprint,
} from "./watchlist-restore-operator-evidence";
import {
  decodeRestoreExecution,
  inspectRestoreDeployment,
  inspectRestoreFunction,
  WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS,
} from "./watchlist-restore-operator-function";
import { WATCHLIST_RESTORE_SOURCE_CREATES } from "./watchlist-restore-operator-plan";

const TARGET = WATCHLIST_RESTORE_PROOF_TARGET;
const FUNCTION = WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID;
export const WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256 =
  restoreOperatorEvidenceDigest({
    version: 1,
    target: TARGET,
    function: WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS,
    creates: WATCHLIST_RESTORE_SOURCE_CREATES,
    archive: WATCHLIST_RESTORE_ARCHIVE,
    buildProof: WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
    applicationPlan: WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
    operatorDispatches: 89,
    wholeMs: 1200000,
    stepMs: 20000,
    pollBatches: 6,
    pollDelayMs: 30000,
  }).sha256;

type Transport = ReturnType<typeof createRestoreOperatorTransport>;
type Call = (client: Client) => Promise<unknown>;
interface Step extends RestoreOperatorStep {
  readonly label: string;
  readonly params: unknown;
  readonly project?: (value: unknown) => unknown;
}
export interface WatchlistRestoreOperatorReview {
  readonly controllerRevision: string;
  readonly approvalRecordSha256: string;
  readonly reviewedPlanSha256: string;
  readonly allowanceAccepted: true;
  readonly retentionAccepted: true;
  readonly maximumAdditionalSpend: 0;
}
export interface WatchlistRestoreOperatorOptions {
  readonly intent: RestoreOperatorIntent;
  /** Trusted, separately verified decision evidence; a library call does not obtain authority. */
  readonly review: WatchlistRestoreOperatorReview;
  readonly archive: Uint8Array;
  readonly journal: RestoreOperatorJournal;
  readonly key: string;
  readonly signal?: AbortSignal;
  /** Trusted composition/test ports, never public request fields. */
  readonly transportFactory?: () => Transport;
  readonly now?: () => number;
  readonly wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}
export interface WatchlistRestoreOperatorResult {
  readonly outcome: "passed" | "stopped" | "uncertain";
  readonly reason:
    "none" | "admission" | "step" | "cleanup" | "journal" | "already_used";
  readonly steps: number;
  readonly requests: number;
  readonly mutationMayHaveCommitted: boolean;
  readonly closed: boolean;
  readonly sourceAndDestinationQualified: boolean;
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function originalMetadata(value: unknown) {
  const source = record(value);
  const result: Record<string, unknown> = {};
  for (const key of [
    "$id",
    "$createdAt",
    "$updatedAt",
    "resourceId",
    "resourceType",
    "archiveId",
    "migrationId",
    "status",
    "startedAt",
    "services",
    "policyId",
    "entrypoint",
    "activate",
    "deploymentId",
    "requestMethod",
    "requestPath",
    "trigger",
    "responseStatusCode",
    "key",
    "absent",
  ]) {
    const entry = source[key];
    if (typeof entry === "string" && Buffer.byteLength(entry) <= 4096)
      result[key] = entry;
    else if (
      typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry))
    )
      result[key] = entry;
    else if (
      key === "services" &&
      Array.isArray(entry) &&
      entry.length <= 16 &&
      entry.every((item) => typeof item === "string" && item.length <= 256)
    )
      result[key] = entry.map((item: unknown) => String(item));
  }
  return result;
}
function databaseId(side: WatchlistRestoreProofSide) {
  return side === "source"
    ? TARGET.sourceDatabaseId
    : TARGET.restoredDatabaseId;
}
function matchingRows(
  a: readonly RowFingerprint[],
  b: readonly RowFingerprint[],
  field: "sha256" | "applicationSha256",
) {
  const project = (rows: readonly RowFingerprint[]) =>
    rows
      .map((row) => [row.rowId, row[field]])
      .sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  assert.deepEqual(project(a), project(b));
}
function enabledItem(
  value: unknown,
  selection: {
    arrayName: string;
    key: string;
    wanted: string;
    enabled: boolean;
  },
) {
  const { arrayName, key, wanted, enabled } = selection;
  const envelope = record(value),
    items = envelope[arrayName];
  assert.ok(Array.isArray(items) && items.length <= 256);
  assert.equal(envelope.total, items.length);
  const matches = items.map(record).filter((item) => item[key] === wanted);
  assert.equal(matches.length, 1);
  if (enabled) assert.equal(matches[0]!.enabled, true);
}
function admit(options: WatchlistRestoreOperatorOptions) {
  const { intent, review } = options;
  restoreOperatorEvidenceDigest(intent);
  restoreOperatorEvidenceDigest(review);
  assert.match(review.controllerRevision, /^[a-f0-9]{40}$/u);
  assert.match(review.approvalRecordSha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    review.reviewedPlanSha256,
    WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256,
  );
  assert.equal(review.allowanceAccepted, true);
  assert.equal(review.retentionAccepted, true);
  assert.equal(review.maximumAdditionalSpend, 0);
  assert.equal(intent.controllerRevision, review.controllerRevision);
  assert.equal(intent.approvalRecordSha256, review.approvalRecordSha256);
  assert.equal(intent.reviewedPlanSha256, review.reviewedPlanSha256);
  assert.equal(intent.endpoint, TARGET.endpoint);
  assert.equal(intent.projectId, TARGET.project);
  assert.equal(intent.archiveSha256, WATCHLIST_RESTORE_ARCHIVE.sha256);
  assert.equal(intent.buildProof, WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF);
  assert.ok(typeof options.key === "string" && options.key.length > 0);
  return admitRestoreOperatorArtifact(
    options.archive,
    WATCHLIST_RESTORE_ARCHIVE,
  );
}

class RestoreRun {
  readonly intent: RestoreOperatorIntent;
  readonly started = performance.now();
  readonly now: () => number;
  readonly wait: NonNullable<WatchlistRestoreOperatorOptions["wait"]>;
  transport?: Transport;
  steps = 0;
  consumed = false;
  mutation = false;
  reason: WatchlistRestoreOperatorResult["reason"] = "admission";
  passed = false;
  closed = true;
  constructor(readonly options: WatchlistRestoreOperatorOptions) {
    this.intent = Object.freeze({ ...options.intent });
    this.now = options.now ?? Date.now;
    this.wait =
      options.wait ??
      ((milliseconds, signal) => delay(milliseconds, undefined, { signal }));
  }
  check() {
    const now = this.now(),
      elapsed = performance.now() - this.started;
    assert.ok(Number.isFinite(now) && now < Date.parse(this.intent.expiresAt));
    assert.ok(
      new Date(this.intent.expiresAt).toISOString() === this.intent.expiresAt,
    );
    assert.ok(Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 1200000);
    assert.ok(!this.options.signal?.aborted);
  }
  async step(step: Step, call: Call) {
    this.check();
    assert.ok(this.transport && this.steps < 89);
    const ordinal = ++this.steps;
    await this.options.journal.before({
      ordinal,
      label: step.label,
      method: step.method,
      path: "/v1" + step.path,
      requestSha256: restoreOperatorEvidenceDigest(step.params).sha256,
    });
    this.check();
    if (step.method !== "GET") this.mutation = true;
    const value = await this.transport.runStep(
      { method: step.method, path: "/v1" + step.path },
      call,
    );
    const originalResult = restoreOperatorEvidenceDigest(value);
    let admitted: unknown = null,
      refused = false;
    try {
      if (step.project) admitted = step.project(value);
    } catch {
      refused = true;
    }
    await this.options.journal.received(ordinal, {
      originalResult,
      originalMetadata: originalMetadata(value),
      admission: refused
        ? "refused"
        : step.project
          ? "accepted"
          : "pending_aggregate_check",
      admitted,
      transport: this.transport.snapshot(),
    });
    assert.equal(refused, false);
    this.check();
    return value;
  }
  async decoded<T>(
    step: Step,
    call: Call,
    project: (value: unknown) => T,
  ): Promise<T> {
    let result!: T;
    await this.step(
      {
        ...step,
        project(value) {
          result = project(value);
          return result;
        },
      },
      call,
    );
    return result;
  }
  get(label: string, path: string, params: unknown, call: Call) {
    return this.step({ label, path, params, method: "GET" }, call);
  }
  post(label: string, path: string, params: unknown, call: Call) {
    return this.step({ label, path, params, method: "POST" }, call);
  }
  async poll<T>(
    initialDelay: boolean,
    observe: () => Promise<T>,
    ready: (value: T) => boolean,
  ) {
    for (let index = 0; index < 6; index++) {
      if (initialDelay || index > 0) {
        this.check();
        await this.wait(30000, this.options.signal);
        this.check();
      }
      const value = await observe();
      if (ready(value)) return value;
    }
    throw new Error("Restore observation budget exhausted");
  }
  async absent(side: WatchlistRestoreProofSide | "function") {
    const id = side === "function" ? FUNCTION : databaseId(side);
    const path = side === "function" ? "/functions/" + id : "/tablesdb/" + id;
    const expected =
      side === "function" ? "function_not_found" : "database_not_found";
    const value = await this.get(
      "absent-" + side,
      path,
      { id },
      async (client) => {
        try {
          return side === "function"
            ? await new Functions(client).get({ functionId: id })
            : await new TablesDB(client).get({ databaseId: id });
        } catch (error) {
          if (
            error instanceof RestoreOperatorTransportError &&
            error.absence === expected
          )
            return { absent: expected };
          throw error;
        }
      },
    );
    assert.deepEqual(value, { absent: expected });
  }
  async specifications() {
    const runtimes = await this.get(
      "runtimes",
      "/functions/runtimes",
      {},
      (client) => new Functions(client).listRuntimes(),
    );
    enabledItem(runtimes, {
      arrayName: "runtimes",
      key: "$id",
      wanted: "node-24",
      enabled: false,
    });
    for (const [type, wanted] of [
      ["builds", "s-2vcpu-2gb"],
      ["runtimes", "s-0.5vcpu-512mb"],
    ] as const) {
      const result = await this.get(
        "specification-" + type,
        "/functions/specifications",
        { type },
        (client) => new Functions(client).listSpecifications({ type }),
      );
      enabledItem(result, {
        arrayName: "specifications",
        key: "slug",
        wanted,
        enabled: true,
      });
    }
  }
  async createSource() {
    for (const operation of WATCHLIST_RESTORE_SOURCE_CREATES) {
      const { params, sdkMethod, path } = operation;
      const value = await this.post(
        "source-create-" + operation.ordinal,
        path,
        params,
        (client) => {
          const tables = new TablesDB(client);
          switch (sdkMethod) {
            case "create":
              return tables.create({ ...params });
            case "createTable":
              return tables.createTable({
                ...params,
                permissions: [...params.permissions],
              });
            case "createVarcharColumn":
              return tables.createVarcharColumn({ ...params });
            case "createBigIntColumn":
              return tables.createBigIntColumn({ ...params });
            case "createMediumtextColumn":
              return tables.createMediumtextColumn({ ...params });
          }
        },
      );
      const original = record(value);
      if ("key" in params) assert.equal(original.key, params.key);
      else
        assert.equal(
          original.$id,
          "tableId" in params ? params.tableId : params.databaseId,
        );
    }
  }
  async schema(side: WatchlistRestoreProofSide, complete: boolean) {
    const id = databaseId(side),
      path = "/tablesdb/" + id;
    const database = await this.get(
      side + "-database",
      path,
      { databaseId: id },
      (client) => new TablesDB(client).get({ databaseId: id }),
    );
    const tables = complete
      ? await this.get(
          side + "-tables",
          path + "/tables",
          { databaseId: id, queries: [Query.limit(3)], total: true },
          (client) =>
            new TablesDB(client).listTables({
              databaseId: id,
              queries: [Query.limit(3)],
              total: true,
            }),
        )
      : undefined;
    const table = (tableId: "watchlists" | "receipts") =>
      this.get(
        side + "-" + tableId + "-schema",
        path + "/tables/" + tableId,
        { databaseId: id, tableId },
        (client) => new TablesDB(client).getTable({ databaseId: id, tableId }),
      );
    const watchlists = await table("watchlists");
    return this.decoded(
      {
        method: "GET",
        label: side + "-receipts-schema",
        path: path + "/tables/receipts",
        params: { databaseId: id, tableId: "receipts" },
      },
      (client) =>
        new TablesDB(client).getTable({ databaseId: id, tableId: "receipts" }),
      (receipts) =>
        inspectWatchlistRestoreSchema({
          side,
          database,
          tables,
          watchlists,
          receipts,
        }),
    );
  }
  async rows(
    side: WatchlistRestoreProofSide,
    stage: "empty" | "baseline" | "final",
  ) {
    const id = databaseId(side);
    const table = (tableId: "watchlists" | "receipts") => {
      const params = {
        databaseId: id,
        tableId,
        queries: [Query.limit(4)],
        total: true,
      };
      return this.get(
        side + "-" + tableId + "-" + stage,
        "/tablesdb/" + id + "/tables/" + tableId + "/rows",
        params,
        (client) => new TablesDB(client).listRows(params),
      );
    };
    const watchlists = await table("watchlists");
    const params = {
      databaseId: id,
      tableId: "receipts",
      queries: [Query.limit(4)],
      total: true,
    };
    return this.decoded(
      {
        method: "GET",
        label: side + "-receipts-" + stage,
        path: "/tablesdb/" + id + "/tables/receipts/rows",
        params,
      },
      (client) => new TablesDB(client).listRows(params),
      (receipts) =>
        inspectWatchlistRestoreRows({ side, stage, watchlists, receipts }),
    );
  }
  async emptySource() {
    const params = {
      databaseId: TARGET.sourceDatabaseId,
      queries: [Query.limit(3)],
      total: true,
    };
    const result = record(
      await this.get(
        "source-empty-tables",
        "/tablesdb/" + TARGET.sourceDatabaseId + "/tables",
        params,
        (client) => new TablesDB(client).listTables(params),
      ),
    );
    assert.equal(result.total, 2);
    assert.ok(Array.isArray(result.tables));
    assert.deepEqual(result.tables.map((value) => record(value).$id).sort(), [
      "receipts",
      "watchlists",
    ]);
    await this.rows("source", "empty");
  }
  async createFunction() {
    const settings = WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS;
    const params = {
      ...settings,
      execute: [...settings.execute],
      events: [...settings.events],
      scopes: [...settings.scopes],
      providerBranches: [...settings.providerBranches],
      providerPaths: [...settings.providerPaths],
    };
    inspectRestoreFunction(
      await this.post("function-create", "/functions", params, (client) =>
        new Functions(client).create(params),
      ),
    );
  }
  async deployment(archive: Buffer) {
    await this.createFunction();
    const deploymentParams = {
      functionId: FUNCTION,
      activate: false,
      entrypoint: "main.js",
      commands: "node --check main.js",
    };
    const created = inspectRestoreDeployment(
      await this.post(
        "deployment-create",
        "/functions/" + FUNCTION + "/deployments",
        { ...deploymentParams, code: WATCHLIST_RESTORE_ARCHIVE },
        (client) =>
          new Functions(client).createDeployment({
            ...deploymentParams,
            code: InputFile.fromBuffer(
              archive,
              WATCHLIST_RESTORE_ARCHIVE.filename,
            ),
          }),
      ),
      {},
    );
    const deploymentId = created.id;
    await this.poll(
      true,
      async () =>
        inspectRestoreDeployment(
          await this.get(
            "deployment-ready",
            "/functions/" + FUNCTION + "/deployments/" + deploymentId,
            { functionId: FUNCTION, deploymentId },
            (client) =>
              new Functions(client).getDeployment({
                functionId: FUNCTION,
                deploymentId,
              }),
          ),
          { deploymentId },
        ),
      (value) => value.status === "ready",
    );
    const pointer = { functionId: FUNCTION, deploymentId };
    inspectRestoreFunction(
      await this.step(
        {
          method: "PATCH",
          label: "function-activate-private",
          path: "/functions/" + FUNCTION + "/deployment",
          params: pointer,
        },
        (client) => new Functions(client).updateFunctionDeployment(pointer),
      ),
      deploymentId,
    );
    inspectRestoreFunction(
      await this.get(
        "function-pointer",
        "/functions/" + FUNCTION,
        { functionId: FUNCTION },
        (client) => new Functions(client).get({ functionId: FUNCTION }),
      ),
      deploymentId,
    );
    return deploymentId;
  }
  async phase(phase: WatchlistRestoreProofPhase, deploymentId: string) {
    const params = {
      functionId: FUNCTION,
      body: "",
      async: false,
      xpath: "/proof/" + phase,
      method: ExecutionMethod.POST,
      headers: {},
    };
    return this.decoded(
      {
        method: "POST",
        label: "proof-" + phase,
        path: "/functions/" + FUNCTION + "/executions",
        params,
      },
      (client) => new Functions(client).createExecution(params),
      (value) => decodeRestoreExecution(value, { phase, deploymentId }),
    );
  }
  async archive() {
    const expected = {
      sourceResourceId: TARGET.sourceDatabaseId,
      expectedResourceType: "database",
    };
    const params = {
      services: [BackupServices.Tablesdb],
      resourceId: TARGET.sourceDatabaseId,
    };
    let receipt = await this.decoded(
      {
        method: "POST",
        label: "archive-create",
        path: "/backups/archives",
        params,
      },
      (client) => new Backups(client).createArchive(params),
      (value) => decodeNativeBackupArchive(value, expected),
    );
    assert.ok(receipt.progress !== "failed" && receipt.progress !== "skipped");
    receipt = await this.poll(
      true,
      async () => {
        const expectation = {
          ...expected,
          archiveId: receipt.id,
          ...(receipt.migrationId ? { migrationId: receipt.migrationId } : {}),
        };
        receipt = await this.decoded(
          {
            method: "GET",
            label: "archive-observe",
            path: "/backups/archives/" + receipt.id,
            params: { archiveId: receipt.id },
          },
          (client) => new Backups(client).getArchive({ archiveId: receipt.id }),
          (value) => decodeNativeBackupArchive(value, expectation),
        );
        assert.ok(
          receipt.progress !== "failed" && receipt.progress !== "skipped",
        );
        return receipt;
      },
      (value) => value.progress === "completed",
    );
    return receipt;
  }
  async restore(archive: NativeBackupArchiveReceipt) {
    await this.absent("restored");
    const params = {
      archiveId: archive.id,
      services: [BackupServices.Tablesdb],
      newResourceId: TARGET.restoredDatabaseId,
      newResourceName: "Watchlist restored qualification",
    };
    const expected = {
      archive,
      requestedDestinationResourceId: TARGET.restoredDatabaseId,
    };
    let receipt = await this.decoded(
      {
        method: "POST",
        label: "restoration-create",
        path: "/backups/restoration",
        params,
      },
      (client) => new Backups(client).createRestoration(params),
      (value) => decodeNativeBackupRestoration(value, expected),
    );
    assert.notEqual(receipt.progress, "failed");
    await this.poll(
      true,
      async () => {
        const expectation = {
          ...expected,
          restorationId: receipt.id,
          ...(receipt.migrationId ? { migrationId: receipt.migrationId } : {}),
        };
        receipt = await this.decoded(
          {
            method: "GET",
            label: "restoration-observe",
            path: "/backups/restorations/" + receipt.id,
            params: { restorationId: receipt.id },
          },
          (client) =>
            new Backups(client).getRestoration({ restorationId: receipt.id }),
          (value) => decodeNativeBackupRestoration(value, expectation),
        );
        assert.notEqual(receipt.progress, "failed");
        return receipt;
      },
      (value) => value.progress === "completed",
    );
  }
  async workflow(archive: Buffer) {
    await this.absent("source");
    await this.absent("restored");
    await this.absent("function");
    await this.specifications();
    await this.createSource();
    await this.poll(
      false,
      () => this.schema("source", false),
      (value) => value === "available",
    );
    await this.emptySource();
    const deploymentId = await this.deployment(archive);
    await this.phase("preflight", deploymentId);
    const seed = await this.phase("seed", deploymentId);
    assert.equal(await this.schema("source", true), "available");
    const source = await this.rows("source", "baseline");
    matchingRows(source, seed.rowFingerprints, "sha256");
    await this.restore(await this.archive());
    assert.equal(await this.schema("restored", true), "available");
    const restored = await this.rows("restored", "baseline");
    matchingRows(source, restored, "applicationSha256");
    const verified = await this.phase("verify-restored", deploymentId);
    const unchanged = await this.phase("verify-source", deploymentId);
    matchingRows(source, unchanged.rowFingerprints, "sha256");
    matchingRows(source, await this.rows("source", "final"), "sha256");
    matchingRows(
      verified.rowFingerprints,
      await this.rows("restored", "final"),
      "sha256",
    );
  }
  async begin() {
    const archive = admit({ ...this.options, intent: this.intent });
    this.check();
    await this.options.journal.consume(this.intent);
    this.consumed = true;
    this.check();
    this.transport =
      this.options.transportFactory?.() ??
      createRestoreOperatorTransport({
        endpoint: this.intent.endpoint,
        projectId: this.intent.projectId,
        key: this.options.key,
        ...(this.options.signal ? { signal: this.options.signal } : {}),
      });
    this.closed = false;
    this.reason = "step";
    await this.workflow(archive);
    this.passed = true;
    this.reason = "none";
  }
  async close() {
    if (!this.transport) return;
    try {
      await this.transport.close();
      this.closed = this.transport.snapshot().closed;
      assert.ok(this.closed);
    } catch {
      this.passed = false;
      this.reason = "cleanup";
    }
  }
  result(): WatchlistRestoreOperatorResult {
    return {
      outcome: this.passed ? "passed" : this.mutation ? "uncertain" : "stopped",
      reason: this.reason,
      steps: this.steps,
      requests: this.transport?.snapshot().requests ?? 0,
      mutationMayHaveCommitted: this.mutation,
      closed: this.closed,
      sourceAndDestinationQualified: this.passed,
    };
  }
  async finish() {
    const result = this.result();
    if (this.consumed) {
      try {
        await this.options.journal.finish(result);
      } catch {
        return Object.freeze({
          ...result,
          outcome: "uncertain" as const,
          reason: "journal" as const,
          sourceAndDestinationQualified: false,
        });
      }
    }
    return Object.freeze(result);
  }
  async execute() {
    try {
      await this.begin();
    } catch (error) {
      this.passed = false;
      if (error instanceof RestoreOperatorJournalError) this.reason = "journal";
    } finally {
      await this.close();
    }
    return this.finish();
  }
}

const ALREADY_USED = Object.freeze({
  outcome: "stopped",
  reason: "already_used",
  steps: 0,
  requests: 0,
  mutationMayHaveCommitted: false,
  closed: true,
  sourceAndDestinationQualified: false,
} as const);

/** Source-only composition. A separately reviewed private entry must supply actual operation authority. */
export function createWatchlistRestoreOperator(
  input: WatchlistRestoreOperatorOptions,
) {
  const options = Object.freeze({
    ...input,
    intent: Object.freeze({ ...input.intent }),
    review: Object.freeze({ ...input.review }),
  });
  let used = false;
  return Object.freeze({
    run(): Promise<WatchlistRestoreOperatorResult> {
      if (used) return Promise.resolve(ALREADY_USED);
      used = true;
      return new RestoreRun(options).execute();
    },
  });
}
