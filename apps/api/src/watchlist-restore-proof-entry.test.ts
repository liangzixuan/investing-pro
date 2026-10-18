import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtomicStore } from "./test-appwrite-atomic-store";
import { AppwriteException } from "node-appwrite";
import {
  createWatchlistRestoreProofFunction,
  type WatchlistRestoreProofContext,
} from "./watchlist-restore-proof-entry";
import {
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_TARGET,
} from "./watchlist-restore-proof-data";

const mock = vi.hoisted(() => ({
  open: vi.fn(),
  project: vi.fn(),
  key: vi.fn(),
  close: vi.fn(),
  store: undefined as AtomicStore | undefined,
  closed: false,
  signal: undefined as AbortSignal | undefined,
}));
vi.mock("./appwrite-transport", () => ({
  createAppwriteTransport: (options: {
    endpoint: string;
    signal: AbortSignal;
  }) => {
    mock.open(options);
    mock.signal = options.signal;
    const client = {
      setProject: (project: string) => {
        mock.project(project);
        return client;
      },
      setKey: (key: string) => {
        mock.key(key);
        return client;
      },
    };
    return {
      client,
      snapshot: () => ({
        requests: mock.store!.calls.length,
        lastStatus: null,
        closed: mock.closed,
      }),
      close: () => {
        mock.closed = true;
        return Promise.resolve(mock.close());
      },
    };
  },
}));
vi.mock("./appwrite-versioned-row-store", () => ({
  appwriteVersionedRowStore: () => mock.store,
}));
const BUILD = "b".repeat(64);
class ProofStore extends AtomicStore {
  override getRow(input: Parameters<AtomicStore["getRow"]>[0]) {
    if (
      input.databaseId === WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId
    ) {
      this.calls.push({ operation: "getRow", input: structuredClone(input) });
      return Promise.reject(
        new AppwriteException(
          "Invented missing restore database",
          404,
          "database_not_found",
        ),
      );
    }
    return super.getRow(input);
  }
}
function context(patch: Partial<WatchlistRestoreProofContext["req"]> = {}) {
  return {
    req: {
      method: "POST",
      path: "/proof/preflight",
      queryString: "",
      bodyText: "",
      bodyBinary: Buffer.alloc(0),
      headers: { "x-appwrite-key": "invented-platform-key" },
      ...patch,
    },
    res: {
      json: vi.fn(
        (body: unknown, status: number, headers: Record<string, string>) => ({
          body,
          status,
          headers,
        }),
      ),
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.store = new ProofStore();
  mock.closed = false;
  mock.signal = undefined;
});
describe("private fixed Watchlist restore proof entry", () => {
  it.each([
    { method: "GET" },
    { method: "post" },
    { path: "/proof/seed/" },
    { path: "/proof/unknown" },
    { path: "/proof/%73eed" },
    { path: "/proof/seed?target=other" },
    { queryString: "target=other" },
    { queryString: null },
    { bodyText: "{}" },
    { bodyText: " " },
    { bodyText: undefined },
    { bodyBinary: undefined },
    { bodyBinary: null },
    { bodyBinary: new Uint8Array(0) },
    { bodyBinary: Buffer.from("target") },
  ])(
    "refuses nonempty or unsupported request before transport: %j",
    async (patch) => {
      const c = context(patch);
      await createWatchlistRestoreProofFunction(BUILD)(c);
      expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
        { error: "invalid_proof_request" },
        400,
        { "cache-control": "no-store" },
      );
      expect(mock.open).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { "x-appwrite-key": "" },
    { "x-appwrite-key": "  " },
    { "x-appwrite-key": 123 },
    { "x-appwrite-key": "x".repeat(8193) },
  ])("requires bounded platform authority", async (headers) => {
    const c = context({ headers });
    await createWatchlistRestoreProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      { error: "proof_authority_unavailable" },
      503,
      { "cache-control": "no-store" },
    );
    expect(mock.open).not.toHaveBeenCalled();
  });
  it.each(WATCHLIST_RESTORE_PROOF_PHASES)(
    "uses only fixed phase %s and fixed transport",
    async (phase) => {
      const c = context({ path: `/proof/${phase}` });
      await createWatchlistRestoreProofFunction(BUILD)(c);
      expect(mock.open).toHaveBeenCalledExactlyOnceWith({
        endpoint: WATCHLIST_RESTORE_PROOF_TARGET.endpoint,
        signal: mock.signal,
        ...(phase === "preflight"
          ? {
              expectedAbsentDatabaseId:
                WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId,
            }
          : {}),
      });
      expect(mock.project).toHaveBeenCalledExactlyOnceWith(
        WATCHLIST_RESTORE_PROOF_TARGET.project,
      );
      expect(mock.key).toHaveBeenCalledExactlyOnceWith("invented-platform-key");
      expect(mock.close).toHaveBeenCalledTimes(1);
      expect(mock.signal?.aborted).toBe(true);
      expect(c.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ phase, buildProof: BUILD }),
        phase === "preflight" || phase === "seed" ? 200 : 409,
        { "cache-control": "no-store" },
      );
    },
  );
  it("ignores caller-selected endpoint, host, rows, authority alternatives and legacy bodies", async () => {
    const c = context({
      headers: {
        "x-appwrite-key": "invented-platform-key",
        host: "untrusted.invalid",
        authorization: "untrusted",
      },
    });
    for (const name of [
      "endpoint",
      "project",
      "databaseId",
      "destination",
      "principal",
      "command",
      "bodyJson",
      "body",
      "bodyRaw",
    ])
      Object.defineProperty(c.req, name, {
        get() {
          throw new Error("private untrusted field");
        },
      });
    await createWatchlistRestoreProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "passed", operationCount: 8 }),
      200,
      { "cache-control": "no-store" },
    );
    expect(mock.open).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://nyc.cloud.appwrite.io/v1" }),
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toMatch(
      /untrusted|platform-key/u,
    );
  });
  it("captures execution authority and phase before the first await", async () => {
    let release!: () => void;
    mock.store!.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const headers = { "x-appwrite-key": "invented-platform-key" };
    const c = context({ headers });
    const result = createWatchlistRestoreProofFunction(BUILD)(c);
    headers["x-appwrite-key"] = "later-authority";
    c.req.path = "/proof/seed";
    c.req.bodyBinary = Buffer.from("late");
    expect(mock.close).not.toHaveBeenCalled();
    release();
    await result;
    expect(mock.key).toHaveBeenCalledExactlyOnceWith("invented-platform-key");
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "passed", phase: "preflight" }),
      200,
      { "cache-control": "no-store" },
    );
    expect(mock.store!.rows.size).toBe(0);
  });
  it("sanitizes exceptional request fields and does not allocate transport", async () => {
    const c = context();
    Object.defineProperty(c.req, "headers", {
      get() {
        throw new Error("private context");
      },
    });
    await createWatchlistRestoreProofFunction(BUILD)(c);
    expect(mock.open).not.toHaveBeenCalled();
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private context",
    );
  });
  it("closes an allocated transport if SDK configuration fails", async () => {
    mock.key.mockImplementation(() => {
      throw new Error("private SDK authority");
    });
    const c = context();
    await createWatchlistRestoreProofFunction(BUILD)(c);
    expect(mock.close).toHaveBeenCalledTimes(1);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", closed: true }),
      409,
      { "cache-control": "no-store" },
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toMatch(
      /private SDK|platform-key/u,
    );
  });
  it("sanitizes transport allocation failure and validates build binding", async () => {
    mock.open.mockImplementation(() => {
      throw new Error("private transport");
    });
    const c = context();
    await createWatchlistRestoreProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "incomplete",
        failure: "cleanup_failed",
      }),
      409,
      { "cache-control": "no-store" },
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private transport",
    );
    expect(() => createWatchlistRestoreProofFunction("bad")).toThrow();
  });
});
