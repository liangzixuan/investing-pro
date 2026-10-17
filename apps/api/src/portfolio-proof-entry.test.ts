import { AppwriteException } from "node-appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  createPortfolioProofFunction,
  type PortfolioProofContext,
} from "./portfolio-proof-entry";
import {
  PORTFOLIO_PROOF_PHASES,
  PORTFOLIO_PROOF_ROWS,
  PORTFOLIO_PROOF_TARGET,
} from "./portfolio-proof-data";

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
      setProject: (value: string) => {
        mock.project(value);
        return client;
      },
      setKey: (value: string) => {
        mock.key(value);
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
const BUILD = "a".repeat(64);
function context(patch: Partial<PortfolioProofContext["req"]> = {}) {
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
  mock.closed = false;
  mock.signal = undefined;
  mock.store = new AtomicStore();
});
describe("private fixed Portfolio proof entry", () => {
  it.each([
    { method: "GET" },
    { method: "post" },
    { path: "/proof/create/" },
    { path: "/proof/unknown-phase" },
    { path: "/proof/%63reate" },
    { path: "/proof/create?phase=preflight" },
    { queryString: "phase=create" },
    { queryString: null },
    { bodyText: "{}" },
    { bodyText: undefined },
    { bodyBinary: undefined },
    { bodyBinary: null },
    { bodyBinary: new Uint8Array(0) },
    { bodyBinary: new ArrayBuffer(0) },
    { bodyBinary: Buffer.from("unexpected") },
    { bodyText: " ", bodyBinary: Buffer.alloc(0) },
  ])("refuses unsupported request before transport: %j", async (patch) => {
    const c = context(patch);
    await createPortfolioProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      { error: "invalid_proof_request" },
      400,
      { "cache-control": "no-store" },
    );
    expect(mock.open).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { "x-appwrite-key": "" },
    { "x-appwrite-key": "  " },
    { "x-appwrite-key": 123 },
    { "x-appwrite-key": "x".repeat(8193) },
  ])("requires bounded platform authority", async (headers) => {
    const c = context({ headers });
    await createPortfolioProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      { error: "proof_authority_unavailable" },
      503,
      { "cache-control": "no-store" },
    );
    expect(mock.open).not.toHaveBeenCalled();
  });
  it.each(PORTFOLIO_PROOF_PHASES)(
    "admits only the fixed phase %s",
    async (phase) => {
      const c = context({ path: `/proof/${phase}` });
      await createPortfolioProofFunction(BUILD)(c);
      expect(mock.open).toHaveBeenCalledTimes(1);
      expect(c.res.json).toHaveBeenCalledWith(
        expect.objectContaining({ phase, buildProof: BUILD }),
        phase === "preflight" || phase === "create" || phase === "capacity"
          ? 200
          : 409,
        { "cache-control": "no-store" },
      );
      expect(mock.closed).toBe(true);
      expect(mock.signal?.aborted).toBe(true);
    },
  );
  it("ignores legacy bodies and caller-selected configuration", async () => {
    const c = context({ queryString: undefined });
    for (const name of [
      "bodyJson",
      "body",
      "bodyRaw",
      "principal",
      "command",
      "catalog",
      "date",
      "endpoint",
      "project",
    ])
      Object.defineProperty(c.req, name, {
        get() {
          throw new Error("untrusted request field");
        },
      });
    await createPortfolioProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "passed",
        operationCount: 17,
        httpDispatches: 17,
        closed: true,
      }),
      200,
      { "cache-control": "no-store" },
    );
    expect(mock.open).toHaveBeenCalledExactlyOnceWith({
      endpoint: PORTFOLIO_PROOF_TARGET.endpoint,
      signal: mock.signal,
    });
    expect(mock.project).toHaveBeenCalledExactlyOnceWith(
      PORTFOLIO_PROOF_TARGET.project,
    );
    expect(mock.store!.calls.map((call) => call.operation)).toEqual(
      PORTFOLIO_PROOF_ROWS.map(() => "getRow"),
    );
  });
  it("captures authority and phase before a held read and closes after settlement", async () => {
    let release!: () => void;
    mock.store!.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const headers = { "x-appwrite-key": "invented-platform-key" };
    const c = context({ headers });
    const task = createPortfolioProofFunction(BUILD)(c);
    expect(mock.signal?.aborted).toBe(false);
    expect(mock.close).not.toHaveBeenCalled();
    headers["x-appwrite-key"] = "later-not-authority";
    c.req.path = "/proof/create";
    c.req.bodyBinary = Buffer.from("late");
    release();
    await task;
    expect(mock.key).toHaveBeenCalledExactlyOnceWith("invented-platform-key");
    expect(mock.close).toHaveBeenCalledTimes(1);
    expect(mock.signal?.aborted).toBe(true);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "preflight",
        outcome: "passed",
        closed: true,
      }),
      200,
      { "cache-control": "no-store" },
    );
  });
  it("refuses exceptional context access without leaking it or opening transport", async () => {
    const c = context();
    Object.defineProperty(c.req, "bodyBinary", {
      get() {
        throw new Error("private context");
      },
    });
    await createPortfolioProofFunction(BUILD)(c);
    expect(mock.open).not.toHaveBeenCalled();
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private context",
    );
  });
  it("closes an allocated transport when SDK configuration throws", async () => {
    mock.key.mockImplementation(() => {
      throw new Error("private setup detail");
    });
    const c = context();
    await createPortfolioProofFunction(BUILD)(c);
    expect(mock.close).toHaveBeenCalledTimes(1);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        failure: "operation_failed",
        closed: true,
      }),
      409,
      { "cache-control": "no-store" },
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private setup detail",
    );
  });
  it("keeps row payloads, authority, and upstream error text out of failure reports", async () => {
    mock.store!.fail = {
      operation: "getRow",
      error: new AppwriteException(
        "private upstream row payload",
        403,
        "private-type",
        "private-response",
      ),
    };
    const c = context();
    await createPortfolioProofFunction(BUILD)(c);
    const raw = JSON.stringify(c.res.json.mock.calls);
    for (const text of [
      "private upstream",
      "private-type",
      "private-response",
      "invented-platform-key",
      "payloadJson",
      "ownerId",
      "idempotencyKey",
    ])
      expect(raw).not.toContain(text);
    expect(mock.close).toHaveBeenCalledTimes(1);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", closed: true }),
      409,
      { "cache-control": "no-store" },
    );
  });
  it("marks cleanup refusal incomplete without returning the raw error", async () => {
    mock.close.mockImplementation(() => {
      throw new Error("private cleanup detail");
    });
    const c = context();
    await createPortfolioProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "incomplete",
        failure: "cleanup_failed",
        cleanupIncomplete: true,
      }),
      409,
      { "cache-control": "no-store" },
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private cleanup detail",
    );
  });
  it("rejects an invalid build binding before creating an invocation", () => {
    expect(() => createPortfolioProofFunction("unbound")).toThrow(
      "Invalid proof build binding",
    );
    expect(mock.open).not.toHaveBeenCalled();
  });
  it("ends a held phase at its fixed deadline and ignores the late row result", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    mock.store!.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const c = context();
    try {
      const task = createPortfolioProofFunction(BUILD)(c);
      await vi.advanceTimersByTimeAsync(11000);
      await task;
      expect(mock.signal?.aborted).toBe(true);
      expect(mock.close).toHaveBeenCalledTimes(1);
      expect(c.res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "incomplete",
          failure: "deadline",
          closed: true,
          operationCount: 1,
        }),
        409,
        { "cache-control": "no-store" },
      );
      const calls = mock.store!.calls.length;
      release();
      await vi.advanceTimersByTimeAsync(1);
      expect(mock.store!.calls).toHaveLength(calls);
      expect(c.res.json).toHaveBeenCalledTimes(1);
    } finally {
      release();
      vi.useRealTimers();
    }
  });
});
