import { Client, Functions, Query, TablesDB } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { MockAgent, Response } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRestoreOperatorTransport,
  RestoreOperatorTransportError,
  RESTORE_OPERATOR_TRANSPORT_LIMITS,
} from "./restore-operator-transport";

const ENDPOINT = "https://restore.example.invalid/v1";
const ID = "invented-source";
const PATH = `/v1/tablesdb/${ID}`;
const JSON_HEADERS = { "content-type": "application/json" };
const SDK_CHUNK_SIZE = Client.CHUNK_SIZE;
const resources: (() => Promise<void>)[] = [];
class OwnedMockAgent extends MockAgent {
  override destroy() {
    return this.close();
  }
}
type Options = Parameters<typeof createRestoreOperatorTransport>[0];
function fixture(limits?: Options["limits"], signal?: AbortSignal) {
  const agent = new OwnedMockAgent();
  agent.disableNetConnect();
  const transport = createRestoreOperatorTransport({
    endpoint: ENDPOINT,
    projectId: "invented-project",
    key: "private-invented-key",
    dispatcher: agent,
    limits: { timeoutMs: 2000, requestTimeoutMs: 500, ...limits },
    ...(signal ? { signal } : {}),
  });
  resources.push(() => transport.close());
  return { ...transport, agent, pool: agent.get(new URL(ENDPOINT).origin) };
}
function read(f: ReturnType<typeof fixture>, path = PATH) {
  return f.runStep({ method: "GET", path }, (client) =>
    new TablesDB(client).get({ databaseId: ID }),
  );
}
function reply(
  f: ReturnType<typeof fixture>,
  status = 200,
  body = "{}",
  headers: Record<string, string> = JSON_HEADERS,
) {
  return f.pool
    .intercept({ path: PATH, method: "GET" })
    .reply(status, body, { headers });
}
interface RequestChange {
  readonly kind: string;
  readonly configure?: (client: Client) => void;
  readonly method?: string;
  readonly route?: string;
  readonly headers?: Record<string, string>;
}
const requestChanges: RequestChange[] = [
  {
    kind: "endpoint",
    configure: (client) => {
      client.setEndpoint("https://other.invalid/v1");
    },
  },
  {
    kind: "project",
    configure: (client) => {
      client.setProject("other-project");
    },
  },
  {
    kind: "key",
    configure: (client) => {
      client.setKey("other-private-key");
    },
  },
  {
    kind: "selfSigned",
    configure: (client) => {
      client.setSelfSigned(true);
    },
  },
  { kind: "host", headers: { host: "other.invalid" } },
  {
    kind: "authorization",
    headers: { authorization: "private-other-authority" },
  },
  { kind: "route", route: "/other" },
  { kind: "method", method: "POST" },
];
interface ContractViolation {
  readonly kind: string;
  readonly setup?: (f: ReturnType<typeof fixture>) => void;
  readonly run: (
    client: Client,
    capturePending: (value: Promise<unknown>) => void,
  ) => Promise<unknown>;
}
const contractViolations: ContractViolation[] = [
  { kind: "none", run: () => Promise.resolve("invented sentinel") },
  {
    kind: "missing-await",
    setup: (f) => {
      reply(f).delay(30);
    },
    run: (client, capturePending) => {
      const pending = new TablesDB(client).get({ databaseId: ID });
      capturePending(pending);
      void pending.catch(() => undefined);
      return Promise.resolve("invented sentinel");
    },
  },
  {
    kind: "second-call",
    setup: (f) => {
      reply(f);
    },
    run: async (client) => {
      const tables = new TablesDB(client);
      await tables.get({ databaseId: ID });
      return tables.get({ databaseId: ID });
    },
  },
  {
    kind: "direct-prepare",
    setup: (f) => {
      reply(f);
    },
    run: async (client) => {
      client.prepareRequest("GET", new URL(ENDPOINT + `/tablesdb/${ID}`));
      await new TablesDB(client).get({ databaseId: ID });
      return "sentinel";
    },
  },
  {
    kind: "redirect",
    run: (client) =>
      client.redirect("GET", new URL(ENDPOINT + `/tablesdb/${ID}`)),
  },
];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Client.CHUNK_SIZE = SDK_CHUNK_SIZE;
  for (const close of resources.splice(0).reverse()) await close();
});

describe("bounded private restore operator transport", () => {
  it("uses one SDK call and physical dispatch per step and owns cleanup", async () => {
    const f = fixture();
    reply(f);
    reply(f);
    await read(f);
    await read(f);
    expect(f.snapshot()).toMatchObject({
      steps: 2,
      requests: 2,
      sealed: false,
      closed: false,
      activeStep: false,
    });
    await f.close();
    await f.close();
    expect(f.snapshot().closed).toBe(true);
    await expect(read(f)).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(f.snapshot().requests).toBe(2);
  });

  it("supports bounded SDK list queries without changing the admitted route", async () => {
    const f = fixture(),
      query = Query.limit(3),
      path = PATH + "/tables";
    f.pool
      .intercept({
        path,
        method: "GET",
        query: { "queries[0]": query, total: "true" },
      })
      .reply(200, '{"total":0,"tables":[]}', { headers: JSON_HEADERS });
    await f.runStep({ method: "GET", path }, (client) =>
      new TablesDB(client).listTables({
        databaseId: ID,
        queries: [query],
        total: true,
      }),
    );
    expect(f.snapshot().requests).toBe(1);
    f.agent.assertNoPendingInterceptors();
  });

  it("uses exactly one JSON POST and one JSON PATCH through SDK services", async () => {
    const f = fixture();
    f.pool
      .intercept({
        path: "/v1/tablesdb",
        method: "POST",
      })
      .reply(
        201,
        async (options) => {
          const chunks: Buffer[] = [];
          for await (const chunk of options.body as AsyncIterable<Uint8Array>)
            chunks.push(Buffer.from(chunk));
          const value: unknown = JSON.parse(
            Buffer.concat(chunks).toString("utf8"),
          );
          expect(value).toEqual({
            databaseId: ID,
            name: "Invented source",
            enabled: true,
          });
          return "{}";
        },
        { headers: JSON_HEADERS },
      );
    f.pool
      .intercept({
        path: "/v1/functions/invented-function/deployment",
        method: "PATCH",
      })
      .reply(
        200,
        async (options) => {
          const chunks: Buffer[] = [];
          for await (const chunk of options.body as AsyncIterable<Uint8Array>)
            chunks.push(Buffer.from(chunk));
          expect(Buffer.concat(chunks).toString("utf8")).toBe(
            '{"deploymentId":"invented-deployment"}',
          );
          return "{}";
        },
        { headers: JSON_HEADERS },
      );
    await f.runStep({ method: "POST", path: "/v1/tablesdb" }, (client) =>
      new TablesDB(client).create({
        databaseId: ID,
        name: "Invented source",
        enabled: true,
      }),
    );
    await f.runStep(
      {
        method: "PATCH",
        path: "/v1/functions/invented-function/deployment",
      },
      (client) =>
        new Functions(client).updateFunctionDeployment({
          functionId: "invented-function",
          deploymentId: "invented-deployment",
        }),
    );
    expect(f.snapshot().requests).toBe(2);
  });

  it("refuses oversized JSON and oversized upload scalars before dispatch", async () => {
    const json = fixture();
    await expect(
      json.runStep({ method: "POST", path: "/v1/tablesdb" }, async (client) => {
        const value: unknown = await client.call(
          "POST",
          new URL(ENDPOINT + "/tablesdb"),
          JSON_HEADERS,
          { private: "x".repeat(65537) },
        );
        return value;
      }),
    ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(json.snapshot().requests).toBe(0);
    const upload = fixture();
    await expect(
      upload.runStep(
        { method: "POST", path: "/v1/functions/invented-function/deployments" },
        (client) =>
          new Functions(client).createDeployment({
            functionId: "invented-function",
            code: InputFile.fromBuffer(
              Buffer.alloc(10),
              "function-code.tar.gz",
            ),
            activate: false,
            commands: "x".repeat(4097),
          }),
      ),
    ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(upload.snapshot().requests).toBe(0);
  });

  it("aborts an outstanding SDK request at its deadline and prevents a second dispatch", async () => {
    const f = fixture({ requestTimeoutMs: 10 });
    reply(f).delay(40);
    await expect(read(f)).rejects.toMatchObject({ reason: "deadline" });
    await expect(read(f)).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(f.snapshot()).toMatchObject({ requests: 1, sealed: true });
  });

  it("checks the monotonic step deadline even before its timer can fire", async () => {
    const start = performance.now(),
      clock = vi.spyOn(performance, "now").mockReturnValue(start);
    const f = fixture({ requestTimeoutMs: 100 });
    await expect(
      f.runStep({ method: "GET", path: PATH }, (client) => {
        clock.mockReturnValue(start + 101);
        return new TablesDB(client).get({ databaseId: ID });
      }),
    ).rejects.toMatchObject({ reason: "deadline" });
    expect(f.snapshot()).toMatchObject({ requests: 0, sealed: true });
  });

  it.each(["reject", "hang"])(
    "bounds %s dispatcher cleanup without retrying it",
    async (kind) => {
      const agent = new OwnedMockAgent();
      agent.disableNetConnect();
      const destroy = vi
        .spyOn(agent, "destroy")
        .mockImplementation(() =>
          kind === "reject"
            ? Promise.reject(new Error("private-cleanup-record"))
            : new Promise<void>(() => undefined),
        );
      const f = createRestoreOperatorTransport({
        endpoint: ENDPOINT,
        projectId: "invented",
        key: "invented",
        dispatcher: agent,
        limits: { closeTimeoutMs: 10 },
      });
      await expect(f.close()).rejects.toMatchObject({
        reason: "cleanup_failed",
      });
      await expect(f.close()).rejects.toMatchObject({
        reason: "cleanup_failed",
      });
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(f.snapshot().closed).toBe(false);
      const error: unknown = await f
        .runStep({ method: "GET", path: PATH }, (client) =>
          new TablesDB(client).get({ databaseId: ID }),
        )
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(RestoreOperatorTransportError);
      expect(JSON.stringify(error)).not.toContain("private-cleanup-record");
      expect(f.snapshot()).toMatchObject({ sealed: true, requests: 0 });
      await agent.close();
    },
  );

  it.each([32, 2 * 1024 * 1024])(
    "preserves multipart boundary and copied %s-byte archive in one dispatch",
    async (size) => {
      const f = fixture(),
        bytes = Buffer.alloc(size, 0x78),
        original = Buffer.from(bytes);
      let boundary = "",
        uploaded: unknown;
      f.pool
        .intercept({
          path: "/v1/functions/invented-function/deployments",
          method: "POST",
        })
        .reply(
          201,
          async (options) => {
            const headers = options.headers as Record<string, string>;
            boundary = headers["content-type"] ?? "";
            const chunks: Buffer[] = [];
            for await (const chunk of options.body as AsyncIterable<Uint8Array>)
              chunks.push(Buffer.from(chunk));
            const encoded = Buffer.concat(chunks);
            expect(encoded.length).toBe(Number(headers["content-length"]));
            expect(encoded.length).toBeLessThanOrEqual(
              2 * 1024 * 1024 + 64 * 1024,
            );
            expect(headers["content-range"]).toBeUndefined();
            uploaded = await new Response(encoded, {
              headers: { "content-type": boundary },
            }).formData();
            return '{"$id":"invented-deployment"}';
          },
          { headers: JSON_HEADERS },
        );
      const result = await f.runStep(
        { method: "POST", path: "/v1/functions/invented-function/deployments" },
        async (client) => {
          const operation = new Functions(client).createDeployment({
            functionId: "invented-function",
            code: InputFile.fromBuffer(bytes, "function-code.tar.gz"),
            activate: false,
            entrypoint: "main.js",
            commands: "node --check main.js",
          });
          bytes.fill(0);
          return operation;
        },
      );
      expect(result.$id).toBe("invented-deployment");
      expect(boundary).toMatch(/^multipart\/form-data; boundary=/u);
      const form = uploaded as { get(name: string): unknown };
      const file = form.get("code") as { arrayBuffer(): Promise<ArrayBuffer> };
      expect(Buffer.from(await file.arrayBuffer()).equals(original)).toBe(true);
      expect(form.get("activate")).toBe("false");
      expect(f.snapshot().requests).toBe(1);
      f.agent.assertNoPendingInterceptors();
    },
  );

  it.each(["path", "oversize", "changed-chunk-size"])(
    "refuses %s upload before file reads or wire dispatch",
    async (kind) => {
      const f = fixture();
      const bytes = Buffer.alloc(
        kind === "oversize" ? 2 * 1024 * 1024 + 1 : 10,
      );
      const file =
        kind === "path"
          ? InputFile.fromPath("C:/never-read/private-file")
          : InputFile.fromBuffer(bytes, "function-code.tar.gz");
      const size = vi.spyOn(file, "size"),
        convert = vi.spyOn(file, "toFile");
      if (kind === "changed-chunk-size") Client.CHUNK_SIZE = 1;
      await expect(
        f.runStep(
          {
            method: "POST",
            path: "/v1/functions/invented-function/deployments",
          },
          (client) =>
            new Functions(client).createDeployment({
              functionId: "invented-function",
              code: file,
              activate: false,
            }),
        ),
      ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
      expect(size).not.toHaveBeenCalled();
      expect(convert).not.toHaveBeenCalled();
      expect(f.snapshot()).toMatchObject({ requests: 0, sealed: true });
    },
  );

  it.each([302, 421, 429, 500])(
    "does not redirect or retry HTTP %s",
    async (status) => {
      const f = fixture();
      reply(f, status, '{"message":"private-provider-record"}', {
        ...JSON_HEADERS,
        location: ENDPOINT + "/other",
      });
      await expect(read(f)).rejects.toBeInstanceOf(
        RestoreOperatorTransportError,
      );
      await expect(read(f)).rejects.toBeInstanceOf(
        RestoreOperatorTransportError,
      );
      expect(f.snapshot()).toMatchObject({ requests: 1, sealed: true });
    },
  );

  it.each(requestChanges)(
    "rejects changed $kind before dispatch",
    async (change) => {
      const f = fixture();
      const operation = f.runStep(
        { method: "GET", path: PATH },
        async (client) => {
          change.configure?.(client);
          const result: unknown = await client.call(
            change.method ?? "GET",
            new URL(ENDPOINT + (change.route ?? `/tablesdb/${ID}`)),
            change.headers ?? {},
          );
          return result;
        },
      );
      await expect(operation).rejects.toBeInstanceOf(
        RestoreOperatorTransportError,
      );
      expect(f.snapshot().requests).toBe(0);
    },
  );

  it.each(contractViolations)(
    "seals the $kind step contract violation",
    async (violation) => {
      const f = fixture();
      violation.setup?.(f);
      let pending: Promise<unknown> | undefined;
      const operation = f.runStep({ method: "GET", path: PATH }, (client) =>
        violation.run(client, (value) => {
          pending = value;
        }),
      );
      await expect(operation).rejects.toBeInstanceOf(
        RestoreOperatorTransportError,
      );
      await pending?.catch(() => undefined);
      expect(f.snapshot().requests).toBeLessThanOrEqual(1);
      expect(f.snapshot().sealed).toBe(true);
    },
  );

  it("allows admitted expected absence, then one next step", async () => {
    const f = fixture();
    reply(f, 404, '{"message":"private","type":"database_not_found"}');
    reply(f);
    const absent = await f.runStep(
      { method: "GET", path: PATH },
      async (client) => {
        try {
          return await new TablesDB(client).get({ databaseId: ID });
        } catch (error) {
          expect(error).toMatchObject({
            status: 404,
            absence: "database_not_found",
          });
          return "absent";
        }
      },
    );
    expect(absent).toBe("absent");
    await read(f);
    expect(f.snapshot().requests).toBe(2);
  });

  it("seals unhandled absence and denies a second call after an admitted absence", async () => {
    const f = fixture();
    reply(f, 404, '{"type":"database_not_found"}');
    await expect(read(f)).rejects.toMatchObject({
      status: 404,
      absence: "database_not_found",
    });
    expect(f.snapshot().sealed).toBe(true);
    const second = fixture();
    reply(second, 404, '{"type":"database_not_found"}');
    await expect(
      second.runStep({ method: "GET", path: PATH }, async (client) => {
        const tables = new TablesDB(client);
        await tables.get({ databaseId: ID }).catch(() => undefined);
        return tables.get({ databaseId: ID });
      }),
    ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(second.snapshot().requests).toBe(1);
  });

  it.each(["wrong-route", "wrong-type", "provider-failure"])(
    "cannot admit %s by swallowing its error",
    async (kind) => {
      const f = fixture(),
        path = kind === "wrong-route" ? PATH + "/tables" : PATH;
      f.pool.intercept({ path, method: "GET" }).reply(
        kind === "provider-failure" ? 500 : 404,
        JSON.stringify({
          type: kind === "wrong-type" ? "row_not_found" : "database_not_found",
        }),
        { headers: JSON_HEADERS },
      );
      await expect(
        f.runStep({ method: "GET", path }, async (client) => {
          await client
            .call("GET", new URL(new URL(ENDPOINT).origin + path))
            .catch(() => undefined);
          return "swallowed";
        }),
      ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
      expect(f.snapshot()).toMatchObject({ requests: 1, sealed: true });
    },
  );

  it("preserves only exact function GET absence", async () => {
    const f = fixture(),
      path = "/v1/functions/invented-function";
    f.pool
      .intercept({ path, method: "GET" })
      .reply(404, '{"type":"function_not_found"}', { headers: JSON_HEADERS });
    await expect(
      f.runStep({ method: "GET", path }, (client) =>
        new Functions(client).get({ functionId: "invented-function" }),
      ),
    ).rejects.toMatchObject({ status: 404, absence: "function_not_found" });
  });

  it.each([
    "non-json",
    "compressed",
    "declared-oversize",
    "stream-oversize",
    "malformed-json",
    "socket-error",
  ])("bounds and sanitizes %s response", async (kind) => {
    const f = fixture({ maxResponseBytes: 128 });
    const interception = f.pool.intercept({ path: PATH, method: "GET" });
    if (kind === "socket-error")
      interception.replyWithError(new Error("private-network-secret"));
    else
      interception.reply(
        200,
        kind.includes("oversize")
          ? "x".repeat(256)
          : kind === "malformed-json"
            ? "private-not-json"
            : "{}",
        {
          headers: {
            "content-type":
              kind === "non-json" ? "text/plain" : "application/json",
            ...(kind === "compressed" ? { "content-encoding": "gzip" } : {}),
            ...(kind === "declared-oversize"
              ? { "content-length": "256" }
              : {}),
          },
        },
      );
    const error: unknown = await read(f).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(RestoreOperatorTransportError);
    expect(JSON.stringify(error)).not.toMatch(/private|secret|invented-key/u);
    expect((error as Error).message).toBe(
      "Restore operator transport stopped.",
    );
    expect(f.snapshot()).toMatchObject({ requests: 1, sealed: true });
  });

  it("strips provider warnings and private error responses", async () => {
    const f = fixture(),
      warning = vi.spyOn(console, "warn");
    reply(
      f,
      403,
      '{"message":"private-owner-record","type":"private-type","secret":"private-invented-key"}',
      { ...JSON_HEADERS, "x-appwrite-warning": "private-warning" },
    );
    const error: unknown = await read(f).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 403, absence: null });
    expect(JSON.stringify(error)).not.toMatch(/private|secret/u);
    expect(warning).not.toHaveBeenCalled();
  });

  it("enforces reduced step quota and fixed maximum configuration", async () => {
    const f = fixture({ maxSteps: 1 });
    reply(f);
    await read(f);
    await expect(read(f)).rejects.toMatchObject({ reason: "step_limit" });
    expect(f.snapshot().requests).toBe(1);
    for (const [name, ceiling] of Object.entries(
      RESTORE_OPERATOR_TRANSPORT_LIMITS,
    )) {
      expect(() =>
        createRestoreOperatorTransport({
          endpoint: ENDPOINT,
          projectId: "invented",
          key: "private",
          limits: { [name]: ceiling + 1 },
        }),
      ).toThrow(RestoreOperatorTransportError);
    }
  });

  it.each(["request", "lifetime", "cancellation", "close", "concurrency"])(
    "fences %s and every late callback",
    async (kind) => {
      const cancellation = new AbortController();
      const f = fixture(
        { requestTimeoutMs: 20, timeoutMs: kind === "lifetime" ? 10 : 1000 },
        cancellation.signal,
      );
      let captured: Client | undefined, release!: () => void;
      const block = new Promise<void>((resolve) => {
        release = resolve;
      });
      const first = f.runStep({ method: "GET", path: PATH }, async (client) => {
        captured = client;
        await block;
        return new TablesDB(client).get({ databaseId: ID });
      });
      const rejected = expect(first).rejects.toBeInstanceOf(
        RestoreOperatorTransportError,
      );
      await Promise.resolve();
      if (kind === "cancellation") cancellation.abort();
      if (kind === "close") await f.close();
      if (kind === "concurrency")
        await expect(read(f)).rejects.toBeInstanceOf(
          RestoreOperatorTransportError,
        );
      await rejected;
      release();
      await Promise.resolve();
      await Promise.resolve();
      await expect(
        new TablesDB(captured!).get({ databaseId: ID }),
      ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
      expect(f.snapshot().requests).toBe(0);
    },
  );

  it("fences a captured old client while a fresh step owns the transport", async () => {
    const f = fixture();
    reply(f);
    let captured!: Client;
    await f.runStep({ method: "GET", path: PATH }, (client) => {
      captured = client;
      return new TablesDB(client).get({ databaseId: ID });
    });
    await expect(
      f.runStep({ method: "GET", path: PATH }, () =>
        new TablesDB(captured).get({ databaseId: ID }),
      ),
    ).rejects.toBeInstanceOf(RestoreOperatorTransportError);
    expect(f.snapshot().requests).toBe(1);
  });

  it("rejects invalid configuration and never echoes supplied private values", () => {
    for (const patch of [
      { endpoint: "private-invalid" },
      { endpoint: "http://restore.invalid/v1" },
      { endpoint: ENDPOINT + "/" },
      { projectId: "../private" },
      { key: "private\nheader" },
    ]) {
      let error: unknown;
      try {
        createRestoreOperatorTransport({
          endpoint: ENDPOINT,
          projectId: "invented",
          key: "private",
          ...patch,
        });
      } catch (value) {
        error = value;
      }
      expect(error).toBeInstanceOf(RestoreOperatorTransportError);
      expect(JSON.stringify(error)).not.toContain("private");
    }
  });
});
