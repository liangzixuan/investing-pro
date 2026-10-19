import { AppwriteException } from "node-appwrite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID,
  WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS,
  inspectRestoreFunction,
  inspectRestoreDeployment,
  decodeRestoreExecution,
} from "./watchlist-restore-operator-function";
import {
  runWatchlistRestoreProof,
  type WatchlistRestoreProofReport,
  type WatchlistRestoreProofFactory,
} from "./watchlist-storage-restore-proof";
import {
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_TARGET,
  watchlistRestoreProofLocation,
  type WatchlistRestoreProofPhase,
} from "./watchlist-restore-proof-data";
import { AtomicStore } from "./test-appwrite-atomic-store";

const DEPLOYMENT = "invented-fixed-deployment";
const SAFE_ERROR = "Invalid Watchlist restore operator evidence";
const reports = {} as Record<
  WatchlistRestoreProofPhase,
  WatchlistRestoreProofReport
>;

function proofFactory(store: AtomicStore): WatchlistRestoreProofFactory {
  return () => {
    const start = store.calls.length;
    let closed = false,
      lastStatus: number | null = null;
    const observed = async <T>(action: () => Promise<T>, success = 200) => {
      try {
        const result = await action();
        lastStatus = success;
        return result;
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
              input.databaseId ===
                WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId &&
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

/** Real fixed application proof against invented atomic rows, not cloud restore acceptance. */
beforeAll(async () => {
  const store = new AtomicStore();
  const factory = proofFactory(store);
  for (const phase of WATCHLIST_RESTORE_PROOF_PHASES) {
    if (phase === "verify-restored") {
      for (const version of [undefined, 1, 2] as const) {
        const source = watchlistRestoreProofLocation("source", version);
        const target = watchlistRestoreProofLocation("restored", version);
        const sourceKey = JSON.stringify([
          source.databaseId,
          source.tableId,
          source.rowId,
        ]);
        const row = structuredClone(store.rows.get(sourceKey)!);
        row.$databaseId = target.databaseId;
        store.rows.set(
          JSON.stringify([target.databaseId, target.tableId, target.rowId]),
          row,
        );
      }
    }
    reports[phase] = await runWatchlistRestoreProof(
      phase,
      WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF,
      factory,
    );
    expect(reports[phase].outcome).toBe("passed");
  }
});

function functionMetadata() {
  const { functionId, ...settings } =
    WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS;
  return {
    ...structuredClone(settings),
    $id: functionId,
    live: true,
    deploymentId: DEPLOYMENT,
    vars: [],
    providerSilentMode: false,
    $createdAt: "2026-10-18T00:00:00.000Z",
    $updatedAt: "2026-10-18T00:00:00.000Z",
  };
}
function deployment(status = "ready") {
  return {
    $id: DEPLOYMENT,
    resourceId: WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID,
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
function execution(phase: WatchlistRestoreProofPhase = "seed") {
  return {
    $id: "invented-execution",
    resourceId: WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID,
    resourceType: "functions",
    deploymentId: DEPLOYMENT,
    trigger: "http",
    status: "completed",
    requestMethod: "POST",
    requestPath: `/proof/${phase}`,
    responseStatusCode: 200,
    responseBody: JSON.stringify(reports[phase]),
    requestHeaders: [],
    responseHeaders: [],
    logs: "",
    errors: "",
    duration: 0.05,
  };
}
function reportChange(
  change: (report: WatchlistRestoreProofReport) => void,
  phase: WatchlistRestoreProofPhase = "seed",
) {
  const report = structuredClone(reports[phase]);
  change(report);
  return { ...execution(phase), responseBody: JSON.stringify(report) };
}
function sdkObject<T extends object>(value: T) {
  const stringify = vi.fn(() => {
    throw new Error("private SDK serialization must not run");
  });
  Object.defineProperty(value, "toString", {
    value: stringify,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return { value, stringify };
}

interface ReportMutationGroup {
  readonly group: string;
  readonly target: (report: WatchlistRestoreProofReport) => object;
  readonly changes: readonly Record<string, unknown>[];
}
const reportMutationGroups: ReportMutationGroup[] = [
  {
    group: "report identity/completeness",
    target: (report) => report,
    changes: [
      { version: 2 },
      { buildProof: "a".repeat(64) },
      { planSha256: "b".repeat(64) },
      { phase: "verify-source" },
      { outcome: "incomplete" },
      { failure: "deadline" },
      { repositoryError: "commit_unknown" },
      { operationCount: 18 },
      { httpDispatches: 18 },
      { upstreamStatus: 500 },
      { elapsedMs: -1 },
      { elapsedMs: 12001 },
      { elapsedMs: null },
      { closed: false },
      { cleanupIncomplete: true },
      { unexpected: "private extra field" },
    ],
  },
  {
    group: "trace operation field",
    target: (report) => report.trace[0]!,
    changes: [
      { sequence: 0 },
      { actor: "writer" },
      { operation: "rollback" },
      { outcome: "ok" },
      { status: 200 },
      { errorType: "database_not_found" },
      { transactionStatus: "committed" },
      { private: "not allowed" },
    ],
  },
  {
    group: "row identity and fingerprint",
    target: (report) => report.rowFingerprints[0]!,
    changes: [
      { side: "restored" },
      { rowId: "wrong" },
      { sha256: "invalid" },
      { applicationSha256: "a".repeat(65) },
      { applicationSha256: "a".repeat(64) },
      { other: "private" },
    ],
  },
];
const reportMutations = reportMutationGroups.flatMap(
  ({ group, target, changes }) =>
    changes.map((change) => ({ group, target, change })),
);
function rejectReportMutation(
  change: (report: WatchlistRestoreProofReport) => void,
) {
  const value = reportChange(change);
  expect(() =>
    decodeRestoreExecution(value, { phase: "seed", deploymentId: DEPLOYMENT }),
  ).toThrow(SAFE_ERROR);
}

describe("fixed restore function metadata", () => {
  it("copies the corrected immutable SDK-compatible private settings", () => {
    expect(WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS).toMatchObject({
      functionId: "investment_watchlist_restore_v1",
      runtime: "node-24",
      execute: [],
      events: [],
      schedule: "",
      enabled: true,
      logging: false,
      timeout: 15,
      scopes: ["rows.read", "rows.write"],
      commands: "node --check main.js",
      entrypoint: "main.js",
      buildSpecification: "s-2vcpu-2gb",
      runtimeSpecification: "s-0.5vcpu-512mb",
      deploymentRetention: 0,
    });
    expect(Object.isFrozen(WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS)).toBe(
      true,
    );
    expect(
      Object.isFrozen(WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS.scopes),
    ).toBe(true);
    expect(() =>
      inspectRestoreFunction(functionMetadata(), DEPLOYMENT),
    ).not.toThrow();
  });
  it.each([
    { $id: "wrong" },
    { name: "another purpose" },
    { runtime: "node-22" },
    { execute: ["any"] },
    { events: ["users.*"] },
    { schedule: "* * * * *" },
    { enabled: false },
    { logging: true },
    { timeout: 16 },
    { scopes: ["rows.read"] },
    { scopes: ["rows.read", "rows.write", "databases.write"] },
    { commands: "curl private" },
    { entrypoint: "other.js" },
    { buildSpecification: "builds-2vcpu-2gb" },
    { runtimeSpecification: "s-2vcpu-2gb" },
    { deploymentRetention: 1 },
    { installationId: "vcs" },
    { providerRepositoryId: "repo" },
    { providerBranch: "main" },
    { providerRootDirectory: "src" },
    { providerBranches: ["main"] },
    { providerPaths: ["*"] },
    { vars: [{ key: "private", value: "private" }] },
    { deploymentId: "other" },
    { live: false },
  ])("refuses changed private settings %j", (change) => {
    expect(() =>
      inspectRestoreFunction({ ...functionMetadata(), ...change }, DEPLOYMENT),
    ).toThrow(SAFE_ERROR);
  });
  it("binds the active pointer only after capture and rejects missing settings", () => {
    expect(() =>
      inspectRestoreFunction({
        ...functionMetadata(),
        live: false,
        deploymentId: "",
      }),
    ).not.toThrow();
    const raw: Record<string, unknown> = functionMetadata();
    delete raw.runtimeSpecification;
    expect(() => inspectRestoreFunction(raw)).toThrow(SAFE_ERROR);
  });
  it("accepts SDK nonenumerable toString without invoking it", () => {
    const { value, stringify } = sdkObject(functionMetadata());
    inspectRestoreFunction(value, DEPLOYMENT);
    expect(stringify).not.toHaveBeenCalled();
  });
  it("refuses an accessor without reading or exposing it", () => {
    const value = functionMetadata();
    const getter = vi.fn(() => {
      throw new Error("private authority");
    });
    Object.defineProperty(value, "commands", { get: getter, enumerable: true });
    expect(() => inspectRestoreFunction(value)).toThrow(SAFE_ERROR);
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("fixed settings array admission", () => {
  it("refuses sparse scopes rather than skipping their missing values", () => {
    expect(() =>
      inspectRestoreFunction({
        ...functionMetadata(),
        scopes: new Array<string>(2),
      }),
    ).toThrow(SAFE_ERROR);
  });
  it("refuses a scopes accessor without invoking it", () => {
    const scopes = ["rows.read", "rows.write"];
    const getter = vi.fn(() => "rows.read");
    Object.defineProperty(scopes, "0", { get: getter, enumerable: true });
    expect(() =>
      inspectRestoreFunction({ ...functionMetadata(), scopes }),
    ).toThrow(SAFE_ERROR);
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("fixed restore deployment metadata", () => {
  it.each(["waiting", "processing", "building"])(
    "admits the known pending state %s",
    (status) => {
      expect(inspectRestoreDeployment(deployment(status), {})).toEqual({
        id: DEPLOYMENT,
        status: "pending",
      });
    },
  );
  it("captures the ready ID and binds later reads without invented command/hash echo", () => {
    const value = deployment();
    expect(Object.hasOwn(value, "commands")).toBe(false);
    expect(Object.hasOwn(value, "sha256")).toBe(false);
    const result = inspectRestoreDeployment(value, {
      deploymentId: DEPLOYMENT,
    });
    expect(result).toEqual({ id: DEPLOYMENT, status: "ready" });
    expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([
    { status: "failed" },
    { status: "canceled" },
    { status: "queued" },
    { status: "" },
    { $id: "../path" },
    { $id: "another-deployment" },
    { resourceId: "another-function" },
    { resourceType: "sites" },
    { entrypoint: "worker.js" },
    { activate: true },
    { sourceSize: 2097153 },
    { buildSize: -1 },
    { totalSize: Infinity },
    { buildDuration: Infinity },
    { $createdAt: "2026-02-31T00:00:00Z" },
    { providerRepositoryName: "attached" },
    { providerCommitHash: "new-code" },
  ])("refuses deployment identity/state/metadata changes %j", (change) => {
    expect(() =>
      inspectRestoreDeployment(
        { ...deployment(), ...change },
        { deploymentId: DEPLOYMENT },
      ),
    ).toThrow(SAFE_ERROR);
  });
  it("accepts SDK metadata without calling toString", () => {
    const { value, stringify } = sdkObject(deployment());
    expect(inspectRestoreDeployment(value, {}).status).toBe("ready");
    expect(stringify).not.toHaveBeenCalled();
  });
});

describe("fixed restore execution evidence", () => {
  it.each(WATCHLIST_RESTORE_PROOF_PHASES)(
    "decodes the real invented application proof for %s",
    (phase) => {
      const value = execution(phase);
      const before = structuredClone(value);
      const report = decodeRestoreExecution(value, {
        phase,
        deploymentId: DEPLOYMENT,
      });
      expect(report).toEqual(reports[phase]);
      expect(report.operationCount).toBe(
        { preflight: 8, seed: 19, "verify-restored": 18, "verify-source": 6 }[
          phase
        ],
      );
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(report.trace)).toBe(true);
      expect(Object.isFrozen(report.trace[0])).toBe(true);
      expect(Object.isFrozen(report.rowFingerprints)).toBe(true);
      expect(value).toEqual(before);
      expect(JSON.stringify(report)).not.toMatch(
        /payloadJson|ownerId|requestHeaders/u,
      );
    },
  );
  it.each([
    { $id: "" },
    { resourceId: "wrong" },
    { resourceType: "sites" },
    { deploymentId: "wrong" },
    { trigger: "schedule" },
    { trigger: "event" },
    { requestMethod: "GET" },
    { requestPath: "/proof/preflight" },
    { requestPath: "/proof/seed?query=yes" },
    { status: "processing" },
    { status: "failed" },
    { responseStatusCode: 409 },
    { duration: Infinity },
    { duration: -1 },
    { duration: 15.001 },
    { errors: "private provider error" },
    { logs: "unexpected private logging" },
    { scheduledAt: "2026-10-18T00:00:00Z" },
    { responseBody: "private-not-json" },
    { responseBody: "é".repeat(4097) },
  ])("refuses execution identity/lifetime/HTTP changes %j", (change) => {
    expect(() =>
      decodeRestoreExecution(
        { ...execution(), ...change },
        { phase: "seed", deploymentId: DEPLOYMENT },
      ),
    ).toThrow(SAFE_ERROR);
  });
  it.each(reportMutations)(
    "refuses $group change $change",
    ({ target, change }) => {
      rejectReportMutation((report) => Object.assign(target(report), change));
    },
  );
  it.each(["checks", "trace", "rowFingerprints"] as const)(
    "refuses removed/reordered/extra %s evidence",
    (field) => {
      const shortened = reportChange((report) =>
        Object.assign(report, { [field]: report[field].slice(1) }),
      );
      expect(() =>
        decodeRestoreExecution(shortened, {
          phase: "seed",
          deploymentId: DEPLOYMENT,
        }),
      ).toThrow(SAFE_ERROR);
      const reversed = reportChange((report) =>
        Object.assign(report, { [field]: [...report[field]].reverse() }),
      );
      expect(() =>
        decodeRestoreExecution(reversed, {
          phase: "seed",
          deploymentId: DEPLOYMENT,
        }),
      ).toThrow(SAFE_ERROR);
    },
  );
  it("accepts the SDK nonenumerable toString and returns only admitted report fields", () => {
    const { value, stringify } = sdkObject(execution());
    const report = decodeRestoreExecution(value, {
      phase: "seed",
      deploymentId: DEPLOYMENT,
    });
    expect(report).toEqual(reports.seed);
    expect(stringify).not.toHaveBeenCalled();
    expect(Object.hasOwn(report, "toString")).toBe(false);
  });
  it("bounds errors even when a hostile metadata proxy throws private text", () => {
    const value = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("private credential provider body");
        },
      },
    );
    expect(() =>
      decodeRestoreExecution(value, {
        phase: "seed",
        deploymentId: DEPLOYMENT,
      }),
    ).toThrow(SAFE_ERROR);
  });
});
