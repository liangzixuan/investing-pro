import { MockAgent } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createValuationAssumptionsProofFunction,
  type ValuationProofContext,
} from "./valuation-assumptions-proof-entry";
import { VALUATION_PROOF_TARGET } from "./valuation-assumptions-proof-data";
import type {
  ValuationProofFactory,
  ValuationProofReport,
} from "./valuation-assumptions-storage-proof-types";
import type { createAppwriteTransport } from "./appwrite-transport";
import type * as AppwriteTransportModule from "./appwrite-transport";

const mock = vi.hoisted(() => ({
  run: vi.fn(),
  agent: undefined as MockAgent | undefined,
  opened: [] as ReturnType<typeof createAppwriteTransport>[],
}));
vi.mock("./valuation-assumptions-storage-proof", () => ({
  runValuationAssumptionsStorageProof: mock.run,
}));
vi.mock("./appwrite-transport", async (original) => {
  const actual = await original<typeof AppwriteTransportModule>();
  return {
    ...actual,
    createAppwriteTransport: (
      options: Parameters<typeof createAppwriteTransport>[0],
    ) => {
      if (!mock.agent) throw new Error("Test transport was not prepared");
      const transport = actual.createAppwriteTransport({
        ...options,
        dispatcher: mock.agent,
      });
      mock.opened.push(transport);
      return transport;
    },
  };
});

class OwnedMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}
const BUILD = "a".repeat(64);
const PRIVATE_KEY = "invented-private-proof-key";
const HEADERS = { "cache-control": "no-store" };
type Request = ValuationProofContext["req"];
function context(patch: Partial<Request> = {}) {
  return {
    req: {
      method: "POST",
      path: "/proof/schema",
      queryString: "",
      bodyText: "",
      bodyBinary: Buffer.alloc(0),
      headers: { "x-appwrite-key": PRIVATE_KEY },
      ...patch,
    },
    res: {
      json: vi.fn((body: unknown, status: number, headers: unknown) => ({
        body,
        status,
        headers,
      })),
    },
  };
}
function report(
  outcome: ValuationProofReport["outcome"] = "passed",
): ValuationProofReport {
  return {
    version: 1,
    buildProof: BUILD,
    planSha256: "b".repeat(64),
    phase: "schema",
    outcome,
    failure: "none",
    repositoryError: null,
    operationCount: 0,
    metadataCount: 2,
    httpDispatches: 2,
    upstreamStatus: null,
    elapsedMs: 1,
    closed: true,
    observedVersion: null,
    rollbackObserved: false,
    cleanupIncomplete: false,
    checks: [],
    rowFingerprints: [],
    currentRecords: [],
    receipts: [],
    trace: [],
    schema: null,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.agent = undefined;
  mock.opened = [];
  mock.run.mockResolvedValue(report());
});
afterEach(async () => {
  for (const transport of mock.opened) await transport.close();
  if (mock.opened.length === 0) await mock.agent?.close();
});

describe("fixed private valuation proof request admission", () => {
  it.each([
    { method: "GET" },
    { method: "post" },
    { path: "/proof/schema/" },
    { path: "/proof/%73chema" },
    { path: "/proof/not-reviewed-phase" },
    { path: "/proof/schema?phase=create-isolation" },
    { queryString: "phase=schema" },
    { queryString: null },
    { bodyText: "{}" },
    { bodyText: " " },
    { bodyText: undefined },
    { bodyBinary: undefined },
    { bodyBinary: new Uint8Array(0) },
    { bodyBinary: new ArrayBuffer(0) },
    { bodyBinary: Buffer.from("unexpected") },
  ])(
    "refuses caller input before any runner or transport: %j",
    async (patch) => {
      const c = context(patch);
      await createValuationAssumptionsProofFunction(BUILD)(c);
      expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
        { error: "invalid_proof_request" },
        400,
        HEADERS,
      );
      expect(mock.run).not.toHaveBeenCalled();
      expect(mock.opened).toEqual([]);
    },
  );

  it.each([undefined, "", "  ", 123, "x".repeat(8193)])(
    "requires bounded platform authority before execution: %j",
    async (key) => {
      const c = context({ headers: { "x-appwrite-key": key } });
      await createValuationAssumptionsProofFunction(BUILD)(c);
      expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
        { error: "proof_authority_unavailable" },
        503,
        HEADERS,
      );
      expect(mock.run).not.toHaveBeenCalled();
    },
  );

  it("refuses a throwing required field without exposing its error", async () => {
    const c = context();
    Object.defineProperty(c.req, "path", {
      get() {
        throw new Error(PRIVATE_KEY);
      },
    });
    await createValuationAssumptionsProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      { error: "invalid_proof_request" },
      400,
      HEADERS,
    );
    expect(mock.run).not.toHaveBeenCalled();
  });

  it("ignores caller-selected authority and legacy body fields", async () => {
    const c = context({ queryString: undefined });
    for (const name of [
      "principal",
      "command",
      "catalog",
      "endpoint",
      "project",
      "bodyJson",
    ])
      Object.defineProperty(c.req, name, {
        get() {
          throw new Error(`Unexpected field: ${name}`);
        },
      });
    await createValuationAssumptionsProofFunction(BUILD)(c);
    expect(mock.run).toHaveBeenCalledExactlyOnceWith(
      "schema",
      BUILD,
      expect.anything(),
    );
    expect(typeof mock.run.mock.calls[0]![2]).toBe("function");
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(report(), 200, HEADERS);
  });

  it.each(["failed", "incomplete"] as const)(
    "returns a non-pass without retrying: %s",
    async (outcome) => {
      mock.run.mockResolvedValueOnce(report(outcome));
      const c = context();
      await createValuationAssumptionsProofFunction(BUILD)(c);
      expect(mock.run).toHaveBeenCalledTimes(1);
      expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
        report(outcome),
        409,
        HEADERS,
      );
    },
  );

  it("returns only a finite refusal when the runner fails", async () => {
    mock.run.mockRejectedValueOnce(
      new Error(`${PRIVATE_KEY}: raw provider body`),
    );
    const c = context();
    await createValuationAssumptionsProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      { error: "proof_unavailable" },
      503,
      HEADERS,
    );
    expect(mock.run).toHaveBeenCalledTimes(1);
  });

  it.each(["", "a".repeat(63), "A".repeat(64), "a".repeat(65)])(
    "refuses an invalid build binding before accepting requests",
    (build) => {
      expect(() => createValuationAssumptionsProofFunction(build)).toThrow(
        "Invalid proof build binding",
      );
      expect(mock.run).not.toHaveBeenCalled();
    },
  );
});

describe("fixed valuation SDK composition", () => {
  it("returns the owned close handle before SDK authority configuration can fail", async () => {
    const agent = new OwnedMockAgent();
    agent.disableNetConnect();
    mock.agent = agent;
    mock.run.mockImplementationOnce(
      async (
        _phase: unknown,
        _build: unknown,
        factory: ValuationProofFactory,
      ) => {
        const operation = factory(new AbortController().signal);
        const client = mock.opened[0]!.client;
        vi.spyOn(client, "setKey").mockImplementation(() => {
          throw new Error(PRIVATE_KEY);
        });
        try {
          expect(() => operation.newStore()).toThrow(PRIVATE_KEY);
        } finally {
          await operation.close();
        }
        expect(operation.snapshot()).toMatchObject({
          requests: 0,
          closed: true,
        });
        return report("failed");
      },
    );
    const c = context();
    await createValuationAssumptionsProofFunction(BUILD)(c);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(
      report("failed"),
      409,
      HEADERS,
    );
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(PRIVATE_KEY);
  });

  it("captures authority before await and emits only the two fixed metadata reads", async () => {
    const agent = new OwnedMockAgent();
    agent.disableNetConnect();
    mock.agent = agent;
    const pool = agent.get(new URL(VALUATION_PROOF_TARGET.endpoint).origin);
    const base = `/v1/tablesdb/${VALUATION_PROOF_TARGET.databaseId}`;
    const headers = {
      "x-appwrite-project": VALUATION_PROOF_TARGET.project,
      "x-appwrite-key": PRIVATE_KEY,
    };
    pool
      .intercept({ path: base, method: "GET", headers })
      .reply(
        200,
        { marker: "database" },
        { headers: { "content-type": "application/json" } },
      )
      .delay(1);
    const query = new URLSearchParams({
      "queries[0]": JSON.stringify({ method: "limit", values: [3] }),
      total: "true",
    });
    pool
      .intercept({ path: `${base}/tables?${query}`, method: "GET", headers })
      .reply(
        200,
        { total: 2, tables: [] },
        { headers: { "content-type": "application/json" } },
      )
      .delay(1);
    const mutableHeaders = { "x-appwrite-key": PRIVATE_KEY };
    const c = context({ headers: mutableHeaders });
    mock.run.mockImplementationOnce(
      async (
        _phase: unknown,
        _build: unknown,
        factory: ValuationProofFactory,
      ) => {
        await Promise.resolve();
        mutableHeaders["x-appwrite-key"] = "different-after-capture";
        const operation = factory(new AbortController().signal);
        try {
          expect(await operation.metadata()).toMatchObject({
            database: { marker: "database" },
            tableList: { total: 2, tables: [] },
          });
          expect(operation.snapshot().requests).toBe(2);
          expect(operation.snapshot().closed).toBe(false);
        } finally {
          await operation.close();
        }
        expect(operation.snapshot().closed).toBe(true);
        return report();
      },
    );
    await createValuationAssumptionsProofFunction(BUILD)(c);
    agent.assertNoPendingInterceptors();
    expect(mock.opened).toHaveLength(1);
    expect(c.res.json).toHaveBeenCalledExactlyOnceWith(report(), 200, HEADERS);
    expect(JSON.stringify(c.res.json.mock.calls)).not.toContain(PRIVATE_KEY);
  });
});
