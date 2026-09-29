import { createServer, type RequestListener, type Server } from "node:http";
import { connect } from "node:net";

import { AppwriteException, TablesDB } from "node-appwrite";
import { Agent, MockAgent } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteWatchlistStore } from "./appwrite-watchlist-repository";

const ENDPOINT = "https://appwrite.example.invalid/v1";
const PATH = "/v1/tablesdb/db/tables/watchlists/rows/synthetic";
const HEADERS = { "content-type": "application/json" };
const resources: (() => Promise<unknown>)[] = [];

class OwnedMockAgent extends MockAgent {
  // Undici's MockAgent implements close(), but inherits an abstract destroy().
  override destroy(): Promise<void> {
    return this.close();
  }
}

afterEach(async () => {
  for (const close of resources.splice(0).reverse()) await close();
  vi.restoreAllMocks();
});

function fixture(
  limits?: Parameters<typeof createAppwriteTransport>[0]["limits"],
) {
  const agent = new OwnedMockAgent();
  agent.disableNetConnect();
  const transport = createAppwriteTransport({
    endpoint: ENDPOINT,
    dispatcher: agent,
    ...(limits ? { limits } : {}),
  });
  transport.client.setProject("synthetic-project").setKey("synthetic-key");
  resources.push(() => transport.close());
  return {
    ...transport,
    agent,
    pool: agent.get(new URL(ENDPOINT).origin),
    tables: new TablesDB(transport.client),
    read: () =>
      transport.client.call(
        "get",
        new URL(new URL(ENDPOINT).origin + PATH),
        HEADERS,
      ),
  };
}

function reply(
  f: ReturnType<typeof fixture>,
  status = 200,
  body = "{}",
  headers: Record<string, string> = HEADERS,
) {
  f.pool
    .intercept({ path: PATH, method: "GET" })
    .reply(status, body, { headers })
    .delay(1);
}

async function loopbackServer(handler: RequestListener) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  resources.push(() => closeServer(server));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Test address missing");
  return new Agent({
    pipelining: 0,
    allowH2: false,
    // Test-only connector: the SDK still targets its exact synthetic HTTPS origin.
    // This supplied dispatcher sends invented bytes to this one ephemeral socket.
    connect: (_options, callback) => {
      const socket = connect({ host: "127.0.0.1", port: address.port });
      socket.once("connect", () => callback(null, socket));
      socket.once("error", (error) => callback(error, null));
    },
  });
}

function closeServer(server: Server) {
  server.closeAllConnections();
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe("Appwrite bounded SDK transport", () => {
  it("keeps a malformed endpoint out of its error text", () => {
    expect(() =>
      createAppwriteTransport({ endpoint: "synthetic-private-invalid-url" }),
    ).toThrow("Appwrite transport rejected the request.");
  });

  it.each(["Host", "hOsT", ":authority"])(
    "refuses custom %s authority before dispatch",
    async (name) => {
      const f = fixture();
      await expect(
        f.client.call("GET", new URL(ENDPOINT + "/rows"), {
          ...HEADERS,
          [name]: "other.example.invalid",
        }),
      ).rejects.toBeInstanceOf(AppwriteException);
      f.client.addHeader(name, "other.example.invalid");
      await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
      expect(f.snapshot().requests).toBe(0);
    },
  );

  it("rejects an abrupt native disconnect after partial JSON without retrying", async () => {
    let calls = 0;
    const dispatcher = await loopbackServer((_request, response) => {
      calls++;
      response.socket?.end(
        'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"partial":',
      );
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
      limits: { requestTimeoutMs: 150 },
    });
    resources.push(() => transport.close());
    await expect(
      transport.client.call(
        "PATCH",
        new URL(ENDPOINT + "/tablesdb/transactions/synthetic-tx"),
        HEADERS,
        { commit: true },
      ),
    ).rejects.toMatchObject({ code: 0, response: "" });
    expect(calls).toBe(1);
  });
  it.each([
    "http://appwrite.example.invalid/v1",
    "https://user:synthetic@appwrite.example.invalid/v1",
    "https://appwrite.example.invalid/other",
    "https://appwrite.example.invalid/v1?query=1",
    "https://appwrite.example.invalid/v1#fragment",
  ])("rejects untrusted endpoint shape %s", (endpoint) => {
    expect(() => createAppwriteTransport({ endpoint })).toThrow(
      AppwriteException,
    );
  });

  it.each([
    { maxRequests: 0 },
    { maxRequests: 21 },
    { timeoutMs: Infinity },
    { maxResponseBytes: 1.5 },
    { requestTimeoutMs: 2001 },
    { timeoutMs: 10, mutationWindowMs: 11 },
  ])("rejects limits outside the reviewed ceiling %j", (limits) => {
    expect(() =>
      createAppwriteTransport({ endpoint: ENDPOINT, limits }),
    ).toThrow(AppwriteException);
  });

  it("uses real SDK row serialization, fixed credentials and identity encoding", async () => {
    const f = fixture();
    f.pool
      .intercept({
        path: PATH,
        method: "GET",
        headers: {
          "x-appwrite-project": "synthetic-project",
          "x-appwrite-key": "synthetic-key",
          "accept-encoding": "identity",
        },
      })
      .reply(200, '{"version":1}', { headers: HEADERS })
      .delay(1);
    const store = appwriteWatchlistStore(f.tables);
    expect(
      await store.getRow({
        databaseId: "db",
        tableId: "watchlists",
        rowId: "synthetic",
      }),
    ).toEqual({ version: 1 });
    expect(f.snapshot()).toEqual({
      requests: 1,
      lastStatus: 200,
      closed: false,
    });
    f.agent.assertNoPendingInterceptors();
  });

  it("retains SDK safe-number and signed-64-bit bigint decoding", async () => {
    const f = fixture();
    reply(f, 200, '{"safe":9007199254740991,"unsafe":9223372036854775807}');
    expect(await f.read()).toEqual({
      safe: Number.MAX_SAFE_INTEGER,
      unsafe: 9223372036854775807n,
    });
  });

  it.each([
    "attribute_limit_exceeded",
    "transaction_conflict",
    "transaction_failed",
    "document_invalid_structure",
    "row_invalid_structure",
    "general_argument_invalid",
  ])(
    "retains only the finite diagnostic type %s without private error text",
    async (type) => {
      const f = fixture();
      reply(
        f,
        400,
        JSON.stringify({
          message: "synthetic-private-record",
          type,
          extra: "synthetic-private-body",
        }),
      );
      const error: unknown = await f.read().catch((value: unknown) => value);
      expect(error).toMatchObject({
        code: 400,
        type,
        message: "Appwrite request failed.",
        response: "",
      });
      expect(error).not.toHaveProperty("cause");
      expect(JSON.stringify(error)).not.toContain("synthetic-private");
      expect(f.snapshot().requests).toBe(1);
    },
  );

  it("does not preserve a row absence type under a non-404 status", async () => {
    const f = fixture();
    reply(
      f,
      400,
      JSON.stringify({
        message: "synthetic-private-record",
        type: "row_not_found",
      }),
    );
    await expect(f.read()).rejects.toMatchObject({
      code: 400,
      type: "request_failed",
      response: "",
    });
  });

  it("removes upstream warnings and strips error payloads while retaining exact absence", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const f = fixture();
    reply(
      f,
      404,
      '{"message":"synthetic-private-record","type":"row_not_found"}',
      { ...HEADERS, "X-Appwrite-Warning": "synthetic-private-warning" },
    );
    const error: unknown = await f.read().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AppwriteException);
    expect(error).toMatchObject({
      code: 404,
      type: "row_not_found",
      response: "",
      message: "Appwrite request failed.",
    });
    expect(String(error)).not.toContain("synthetic-private");
    expect(warning).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 409, 429, 503])(
    "retains finite status %s without arbitrary upstream type or body",
    async (status) => {
      const f = fixture();
      reply(
        f,
        status,
        '{"message":"synthetic-private-record","type":"synthetic-private-type"}',
      );
      await expect(f.read()).rejects.toMatchObject({
        code: status,
        type: "request_failed",
        response: "",
      });
      expect(f.snapshot().requests).toBe(1);
    },
  );

  it.each([301, 302, 307, 308, 421])(
    "rejects status %s before redirect/retry",
    async (status) => {
      const f = fixture();
      reply(f, status, "{}", {
        ...HEADERS,
        location: "https://other.example.invalid/secret",
      });
      await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
      expect(f.snapshot().requests).toBe(1);
    },
  );

  it.each(["gzip", "br", "deflate", "identity, gzip", ""])(
    "rejects content encoding %j before SDK decoding",
    async (encoding) => {
      const f = fixture();
      reply(f, 200, "{}", { ...HEADERS, "content-encoding": encoding });
      await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
      expect(f.snapshot().requests).toBe(1);
    },
  );

  it.each([
    { "content-type": "text/plain" },
    { ...HEADERS, "content-length": "1025" },
    { ...HEADERS, "content-length": "unknown" },
  ])(
    "rejects invalid response headers before reading the body %j",
    async (headers) => {
      const f = fixture({ maxResponseBytes: 1024 });
      reply(f, 200, "{}", headers);
      await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
    },
  );

  it("bounds streamed bytes even without Content-Length", async () => {
    const f = fixture({ maxResponseBytes: 16 });
    reply(f, 200, JSON.stringify({ long: "a".repeat(20) }));
    await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
    expect(f.snapshot().requests).toBe(1);
  });

  it("rejects malformed JSON without leaking its text", async () => {
    const f = fixture();
    reply(f, 200, "synthetic-private-invalid-json");
    await expect(f.read()).rejects.toMatchObject({
      message: "Appwrite request failed.",
      response: "",
    });
  });

  it("shares a request budget across concurrent SDK operations", async () => {
    const f = fixture({ maxRequests: 2 });
    reply(f);
    const outcomes = await Promise.allSettled([f.read(), f.read()]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(f.snapshot().requests).toBe(1);
    f.pool
      .intercept({
        path: "/v1/tablesdb/transactions/synthetic-tx",
        method: "PATCH",
      })
      .reply(200, '{"status":"rolled_back"}', { headers: HEADERS })
      .delay(1);
    await expect(
      f.tables.updateTransaction({
        transactionId: "synthetic-tx",
        rollback: true,
      }),
    ).resolves.toMatchObject({ status: "rolled_back" });
    expect(f.snapshot().requests).toBe(2);
    await expect(
      f.tables.updateTransaction({
        transactionId: "synthetic-tx",
        rollback: true,
      }),
    ).rejects.toBeInstanceOf(AppwriteException);
    expect(f.snapshot().requests).toBe(2);
  });

  it("accepts mixed-case JSON and native informational responses", async () => {
    const dispatcher = await loopbackServer((_request, response) => {
      response.writeEarlyHints({
        link: "</synthetic.css>; rel=preload; as=style",
      });
      response.writeHead(200, {
        "content-type": "Application/JSON; charset=utf-8",
      });
      response.end('{"ok":true}');
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
    });
    resources.push(() => transport.close());
    await expect(
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS),
    ).resolves.toEqual({ ok: true });
  });

  it("aborts a native oversized chunked body and closes its socket", async () => {
    let closed = false;
    const dispatcher = await loopbackServer((_request, response) => {
      response.on("close", () => {
        closed = true;
      });
      response.writeHead(200, HEADERS);
      response.write('{"value":"');
      response.write("a".repeat(128));
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
      limits: { maxResponseBytes: 32 },
    });
    resources.push(() => transport.close());
    await expect(
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS),
    ).rejects.toBeInstanceOf(AppwriteException);
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(transport.snapshot().requests).toBe(1);
  });

  it("close cancels a pending native request and rejects future work", async () => {
    let arrived = false;
    let closed = false;
    const dispatcher = await loopbackServer((_request, response) => {
      arrived = true;
      response.on("close", () => {
        closed = true;
      });
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
    });
    resources.push(() => transport.close());
    const read = () =>
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS);
    const pending = expect(read()).rejects.toBeInstanceOf(AppwriteException);
    await vi.waitFor(() => expect(arrived).toBe(true));
    await transport.close();
    await pending;
    await vi.waitFor(() => expect(closed).toBe(true));
    await expect(read()).rejects.toBeInstanceOf(AppwriteException);
    expect(transport.snapshot().requests).toBe(1);
  });

  it("does not dispatch cross-origin, changed-endpoint, upload or non-JSON calls", async () => {
    const f = fixture();
    await expect(
      f.client.call(
        "GET",
        new URL("https://other.example.invalid/v1/rows"),
        HEADERS,
      ),
    ).rejects.toBeInstanceOf(AppwriteException);
    await expect(
      f.client.call("POST", new URL(ENDPOINT + "/storage"), {
        "content-type": "multipart/form-data",
      }),
    ).rejects.toBeInstanceOf(AppwriteException);
    await expect(
      f.client.call(
        "GET",
        new URL(ENDPOINT + "/rows"),
        HEADERS,
        {},
        "arrayBuffer",
      ),
    ).rejects.toBeInstanceOf(AppwriteException);
    await expect(
      f.client.redirect("GET", new URL(ENDPOINT + "/rows")),
    ).rejects.toBeInstanceOf(AppwriteException);
    f.client.setEndpoint("https://other.example.invalid/v1");
    await expect(f.read()).rejects.toBeInstanceOf(AppwriteException);
    expect(f.snapshot().requests).toBe(0);
  });

  it("stops mutations at the cutoff but permits a bounded rollback and read", async () => {
    const f = fixture({ mutationWindowMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(
      f.tables.createTransaction({ ttl: 30 }),
    ).rejects.toBeInstanceOf(AppwriteException);
    f.pool
      .intercept({
        path: "/v1/tablesdb/transactions/synthetic-tx",
        method: "PATCH",
      })
      .reply(200, '{"$id":"synthetic-tx","status":"rolled_back"}', {
        headers: HEADERS,
      })
      .delay(1);
    await expect(
      f.tables.updateTransaction({
        transactionId: "synthetic-tx",
        rollback: true,
      }),
    ).resolves.toMatchObject({ status: "rolled_back" });
    expect(
      f.client.prepareRequest(
        "patch",
        new URL(ENDPOINT + "/tablesdb/transactions/synthetic-tx"),
        HEADERS,
        { rollback: true },
      ).options.body,
    ).toBe('{"rollback":true}');
    reply(f);
    await expect(f.read()).resolves.toEqual({});
    expect(f.snapshot().requests).toBe(2);
  });

  it("cancels native socket body consumption at the per-request deadline", async () => {
    let calls = 0;
    let closed = false;
    const dispatcher = await loopbackServer((_request, response) => {
      calls++;
      response.writeHead(200, HEADERS);
      response.write('{"pending":');
      response.on("close", () => {
        closed = true;
      });
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
      limits: { requestTimeoutMs: 150 },
    });
    resources.push(() => transport.close());
    await expect(
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS),
    ).rejects.toBeInstanceOf(AppwriteException);
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(calls).toBe(1);
  });

  it("cancels active native I/O at the shared deadline and refuses later dispatch", async () => {
    let calls = 0;
    let closed = false;
    const dispatcher = await loopbackServer((_request, response) => {
      calls++;
      response.on("close", () => {
        closed = true;
      });
    });
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      dispatcher,
      limits: { timeoutMs: 150, mutationWindowMs: 100 },
    });
    resources.push(() => transport.close());
    const read = () =>
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS);
    await expect(read()).rejects.toBeInstanceOf(AppwriteException);
    await vi.waitFor(() => expect(closed).toBe(true));
    await expect(read()).rejects.toBeInstanceOf(AppwriteException);
    expect(calls).toBe(1);
  });

  it("honors prior caller cancellation and closes without dispatch", async () => {
    const controller = new AbortController();
    controller.abort();
    const agent = new OwnedMockAgent();
    agent.disableNetConnect();
    const transport = createAppwriteTransport({
      endpoint: ENDPOINT,
      signal: controller.signal,
      dispatcher: agent,
    });
    resources.push(() => transport.close());
    await expect(
      transport.client.call("GET", new URL(ENDPOINT + "/rows"), HEADERS),
    ).rejects.toBeInstanceOf(AppwriteException);
    expect(transport.snapshot().requests).toBe(0);
    await transport.close();
    expect(transport.snapshot().closed).toBe(true);
  });
});
