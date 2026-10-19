import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  encodeValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
} from "@research-cockpit/contracts";
import {
  createManagedWorkspaceHandler,
  MANAGED_WORKSPACE_ORIGIN,
  type ManagedWorkspaceHandlerOptions,
} from "./managed-workspace-handler";
import type { ClerkTrialAuth } from "./clerk-trial-auth";
import type { ManagedCatalogService } from "./managed-workspace-catalog";
import {
  ValuationAssumptionsRepositoryError,
  type ValuationAssumptionsRepository,
  type ValuationAssumptionsRecord,
  type ValuationAssumptionsReceipt,
} from "./valuation-assumptions-repository";

const path = "/v1/managed/valuation-assumptions";
const principal = { userId: "invented-valuation-assumptions-owner" };
function command(): ManagedValuationAssumptionsCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-valuation-assumptions-key",
    payload: { schemaVersion: 1, entries: [] },
  };
}

function receipt(input = command()): ValuationAssumptionsReceipt {
  return {
    id: "main",
    version: input.expectedVersion + 1,
    digestSha256: createHash("sha256")
      .update(encodeValuationAssumptionsPayload(input.payload))
      .digest("hex"),
    committedAt: "2026-10-15T00:00:00.000Z",
    replayed: false,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function request(
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  suffix = "",
) {
  return new Request(`https://managed.example.invalid${path}${suffix}`, {
    method,
    headers: {
      origin: MANAGED_WORKSPACE_ORIGIN,
      authorization: "Bearer invented-session",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
}
function fixture(enabled = true) {
  const auth = vi
    .fn<ClerkTrialAuth>()
    .mockResolvedValue({ status: "allowed", principal });
  const get = vi
    .fn<ValuationAssumptionsRepository["get"]>()
    .mockResolvedValue(null);
  const put = vi
    .fn<ValuationAssumptionsRepository["put"]>()
    .mockImplementation((_principal, input) => Promise.resolve(receipt(input)));
  const close = vi.fn<() => Promise<void>>().mockResolvedValue();
  const openValuationAssumptionsRepository = vi.fn<
    NonNullable<
      ManagedWorkspaceHandlerOptions["openValuationAssumptionsRepository"]
    >
  >(() =>
    Promise.resolve({
      repository: { get, put },
      close,
    }),
  );
  const openRepository = vi.fn(() =>
    Promise.reject(new Error("Unexpected watchlist access")),
  );
  const catalogStatus = vi.fn<ManagedCatalogService["status"]>();
  const catalogSearch = vi.fn<ManagedCatalogService["search"]>();
  const catalogResolve = vi.fn<ManagedCatalogService["resolve"]>();
  const catalog: ManagedCatalogService = {
    status: catalogStatus,
    search: catalogSearch,
    resolve: catalogResolve,
  };
  const handler = createManagedWorkspaceHandler({
    auth,
    catalog,
    openRepository,
    openFollowupsRepository: () =>
      Promise.reject(new Error("Unexpected Follow-ups access")),
    ...(enabled ? { openValuationAssumptionsRepository } : {}),
  });
  return {
    handler,
    auth,
    get,
    put,
    close,
    openValuationAssumptionsRepository,
    openRepository,
    catalog,
    catalogStatus,
    catalogSearch,
    catalogResolve,
  };
}
async function json(response: Response) {
  return (await response.json()) as unknown;
}

it.each(["GET", "POST"])(
  "keeps unconfigured %s unavailable without opening any resource",
  async (method) => {
    const f = fixture(false);
    const response = await f.handler(
      request(method, method === "POST" ? command() : undefined),
    );
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ error: "unavailable" });
    expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
    expect(f.openRepository).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
  },
);

it.each(["PUT", "DELETE", "PATCH"])(
  "rejects method %s before authentication and storage",
  async (method) => {
    const f = fixture();
    expect((await f.handler(request(method))).status).toBe(405);
    expect(f.auth).not.toHaveBeenCalled();
    expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
  },
);

it("rejects malformed UTF-8, oversized and compressed bodies before storage", async () => {
  const f = fixture();
  for (const [body, extras, status] of [
    [new Uint8Array([0xff]), {}, 400],
    ["x".repeat(266241), {}, 413],
    ["{}", { "content-encoding": "gzip" }, 415],
  ] as const) {
    const response = await f.handler(
      new Request(`https://managed.example.invalid${path}`, {
        method: "POST",
        headers: {
          origin: MANAGED_WORKSPACE_ORIGIN,
          "content-type": "application/json",
          ...extras,
        },
        body,
      }),
    );
    expect(response.status).toBe(status);
  }
  expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
});

it("returns saved assumptions without consulting current catalog", async () => {
  const f = fixture();
  const saved = command().payload;
  f.get.mockResolvedValue({
    id: "main",
    version: 3,
    payload: saved,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
  });
  expect(await json(await f.handler(request()))).toEqual({
    version: 3,
    payload: saved,
  });
  expect(f.catalogResolve).not.toHaveBeenCalled();
  expect(f.catalogSearch).not.toHaveBeenCalled();
  expect(f.catalogStatus).not.toHaveBeenCalled();
});

it("reads a missing resource as uninitialized version zero without creating rows or accessing watchlist/catalog", async () => {
  const f = fixture();
  const response = await f.handler(request());
  expect(response.status).toBe(200);
  expect(await json(response)).toEqual({
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  });
  expect(f.get).toHaveBeenCalledExactlyOnceWith(principal);
  expect(f.put).not.toHaveBeenCalled();
  expect(f.openRepository).not.toHaveBeenCalled();
  expect(f.catalogStatus).not.toHaveBeenCalled();
  expect(f.close).toHaveBeenCalledOnce();
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("writes the captured command under only the verified principal and projects its exact receipt", async () => {
  const f = fixture(),
    input = command();
  const response = await f.handler(request("POST", input));
  expect(response.status).toBe(200);
  expect(await json(response)).toEqual({
    version: 1,
    payload: input.payload,
    replayed: false,
  });
  expect(f.put).toHaveBeenCalledExactlyOnceWith(principal, input);
  expect(f.get).not.toHaveBeenCalled();
  expect(f.openRepository).not.toHaveBeenCalled();
  expect(f.close).toHaveBeenCalledOnce();
});
it.each(["unauthenticated", "access_denied"] as const)(
  "rejects %s before opening storage",
  async (status) => {
    const f = fixture();
    f.auth.mockResolvedValue({ status });
    const response = await f.handler(request("POST", command()));
    expect(response.status).toBe(status === "access_denied" ? 403 : 401);
    expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
    expect(f.openRepository).not.toHaveBeenCalled();
  },
);
it("admits an exact preflight without auth or storage and denies other origins", async () => {
  const f = fixture();
  const response = await f.handler(
    new Request(`https://managed.example.invalid${path}`, {
      method: "OPTIONS",
      headers: {
        origin: "https://localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    }),
  );
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    "https://localhost",
  );
  expect(f.auth).not.toHaveBeenCalled();
  expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
  const denied = await f.handler(
    new Request(`https://managed.example.invalid${path}`, {
      headers: { origin: "https://other.invalid" },
    }),
  );
  expect(denied.status).toBe(403);
  expect(await json(denied)).toEqual({ error: "origin_denied" });
});
it.each(["?q=x", "?", "?resource=watchlist"])(
  "refuses query %s before auth/storage",
  async (suffix) => {
    const f = fixture();
    const response = await f.handler(
      request("GET", undefined, undefined, suffix),
    );
    expect(response.status).toBe(400);
    expect(f.auth).not.toHaveBeenCalled();
    expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
  },
);
it("rejects invalid command and non-JSON bodies before opening storage", async () => {
  const f = fixture();
  const invalid = await f.handler(
    request("POST", { ...command(), principal: "untrusted" }),
  );
  expect(invalid.status).toBe(400);
  const wrongType = new Request(`https://managed.example.invalid${path}`, {
    method: "POST",
    headers: {
      origin: MANAGED_WORKSPACE_ORIGIN,
      "content-type": "text/plain",
    },
    body: "{}",
  });
  expect((await f.handler(wrongType)).status).toBe(415);
  expect(f.openValuationAssumptionsRepository).not.toHaveBeenCalled();
});
it.each(["id", "version", "payload"])(
  "refuses a malformed stored %s",
  async (field) => {
    const f = fixture();
    const record: ValuationAssumptionsRecord = {
      id: "main",
      version: 1,
      payload: command().payload,
      createdAt: "2026-10-15T00:00:00.000Z",
      updatedAt: "2026-10-15T00:00:00.000Z",
    };
    Object.assign(
      record,
      field === "id"
        ? { id: "other" }
        : field === "version"
          ? { version: 0 }
          : { payload: { schemaVersion: 2, entries: [] } },
    );
    f.get.mockResolvedValue(record);
    const response = await f.handler(request());
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ error: "unavailable" });
    expect(f.close).toHaveBeenCalledOnce();
  },
);
it.each(["id", "version", "digest"])(
  "keeps a malformed write %s result uncertain",
  async (field) => {
    const f = fixture(),
      result = receipt();
    Object.assign(
      result,
      field === "id"
        ? { id: "other" }
        : field === "version"
          ? { version: 2 }
          : { digestSha256: "b".repeat(64) },
    );
    f.put.mockResolvedValue(result);
    const response = await f.handler(request("POST", command()));
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ error: "commit_unknown" });
    expect(f.close).toHaveBeenCalledOnce();
  },
);
it.each([
  ["conflict", 409],
  ["idempotency_conflict", 409],
  ["invalid_request", 400],
  ["access_denied", 403],
  ["commit_unknown", 503],
] as const)(
  "maps repository %s to %i without leaking upstream details",
  async (code, status) => {
    const f = fixture();
    f.put.mockRejectedValue(new ValuationAssumptionsRepositoryError(code));
    const response = await f.handler(request("POST", command()));
    expect(response.status).toBe(status);
    expect(await json(response)).toEqual({ error: code });
    expect(f.close).toHaveBeenCalledOnce();
  },
);
it("closes an operation returned after request retirement without dispatching a write", async () => {
  const f = fixture(),
    abort = new AbortController(),
    held =
      deferred<
        Awaited<ReturnType<typeof f.openValuationAssumptionsRepository>>
      >();
  f.openValuationAssumptionsRepository.mockReturnValue(held.promise);
  const pending = f.handler(request("POST", command(), abort.signal));
  await vi.waitFor(() =>
    expect(f.openValuationAssumptionsRepository).toHaveBeenCalledOnce(),
  );
  abort.abort();
  held.resolve({ repository: { get: f.get, put: f.put }, close: f.close });
  const response = await pending;
  expect(response.status).toBe(408);
  expect(f.put).not.toHaveBeenCalled();
  expect(f.close).toHaveBeenCalledOnce();
});
it("reports an aborted dispatched write as uncertain and never retries it", async () => {
  const f = fixture(),
    abort = new AbortController(),
    held = deferred<ValuationAssumptionsReceipt>();
  f.put.mockReturnValue(held.promise);
  const pending = f.handler(request("POST", command(), abort.signal));
  await vi.waitFor(() => expect(f.put).toHaveBeenCalledOnce());
  abort.abort();
  held.resolve(receipt());
  const response = await pending;
  expect(response.status).toBe(503);
  expect(await json(response)).toEqual({ error: "commit_unknown" });
  expect(f.put).toHaveBeenCalledOnce();
  expect(f.close).toHaveBeenCalledOnce();
});
it("keeps a failed post-write close uncertain", async () => {
  const f = fixture();
  f.close.mockRejectedValue(new Error("Invented close failure"));
  const response = await f.handler(request("POST", command()));
  expect(response.status).toBe(503);
  expect(await json(response)).toEqual({ error: "commit_unknown" });
  expect(f.put).toHaveBeenCalledOnce();
});
