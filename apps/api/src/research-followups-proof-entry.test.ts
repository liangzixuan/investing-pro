import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  createResearchFollowupsProofFunction,
  type ResearchFollowupsProofContext,
} from "./research-followups-proof-entry";
const mock = vi.hoisted(() => ({
  open: vi.fn(),
  project: vi.fn(),
  key: vi.fn(),
  store: undefined as AtomicStore | undefined,
  closed: false,
}));
vi.mock("./appwrite-transport", () => ({
  createAppwriteTransport: (...args: unknown[]) => {
    mock.open(...args);
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
      snapshot: () => ({ requests: 0, lastStatus: null, closed: mock.closed }),
      close: () => {
        mock.closed = true;
        return Promise.resolve();
      },
    };
  },
}));
vi.mock("./appwrite-versioned-row-store", () => ({
  appwriteVersionedRowStore: () => mock.store,
}));
const BUILD = "a".repeat(64);
function context(patch: Partial<ResearchFollowupsProofContext["req"]> = {}) {
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
  vi.clearAllMocks();
  mock.closed = false;
  mock.store = new AtomicStore();
});
describe("private fixed Follow-ups entry admission", () => {
  it.each([
    { method: "GET" },
    { path: "/proof/create/" },
    { path: "/proof/unknown-phase" },
    { path: "/proof/%63reate" },
    { queryString: "phase=create" },
    { queryString: null },
    { bodyText: "{}" },
    { bodyText: undefined },
    { bodyBinary: undefined },
    { bodyBinary: null },
    { bodyBinary: new Uint8Array(0) },
    { bodyBinary: new ArrayBuffer(0) },
    { bodyBinary: Buffer.from("unexpected") },
    { bodyText: "unexpected", bodyBinary: Buffer.alloc(0) },
  ])(
    "refuses contradictory or unsupported context before transport: %j",
    async (patch) => {
      const c = context(patch);
      await createResearchFollowupsProofFunction(BUILD)(c);
      expect(c.res.json).toHaveBeenCalledWith(
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
  ])("requires captured platform authority before storage", async (headers) => {
    const c = context({ headers });
    await createResearchFollowupsProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      { error: "proof_authority_unavailable" },
      503,
      { "cache-control": "no-store" },
    );
    expect(mock.open).not.toHaveBeenCalled();
  });
  it("does not read deprecated or JSON body accessors and admits only the empty binary/text tuple", async () => {
    const c = context();
    for (const name of ["bodyJson", "body", "bodyRaw"])
      Object.defineProperty(c.req, name, {
        get() {
          throw new Error("must not inspect derived or legacy body");
        },
      });
    await createResearchFollowupsProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "passed",
        operationCount: 18,
        closed: true,
      }),
      200,
      { "cache-control": "no-store" },
    );
    expect(mock.open).toHaveBeenCalledTimes(1);
  });
  it("captures key and phase before the first held row read", async () => {
    const store = new AtomicStore();
    mock.store = store;
    let release!: () => void;
    store.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const headers = { "x-appwrite-key": "invented-platform-key" };
    const c = context({ headers });
    const task = createResearchFollowupsProofFunction(BUILD)(c);
    headers["x-appwrite-key"] = "replacement-not-authority";
    c.req.path = "/proof/create";
    c.req.bodyBinary = Buffer.from("late");
    release();
    await task;
    expect(mock.key).toHaveBeenCalledExactlyOnceWith("invented-platform-key");
    expect(mock.project).toHaveBeenCalledExactlyOnceWith(
      "6abac57a0007b7c1a671",
    );
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "preflight", outcome: "passed" }),
      200,
      { "cache-control": "no-store" },
    );
    expect(store.calls.every((item) => item.operation === "getRow")).toBe(true);
  });
  it("refuses an exceptional actual context getter without opening transport", async () => {
    const c = context();
    Object.defineProperty(c.req, "bodyBinary", {
      get() {
        throw new Error("private context");
      },
    });
    await createResearchFollowupsProofFunction(BUILD)(c);
    expect(mock.open).not.toHaveBeenCalled();
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(
      "private context",
    );
  });
});
