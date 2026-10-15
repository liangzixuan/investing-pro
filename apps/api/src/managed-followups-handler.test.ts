import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  encodeResearchFollowupsPayload,
  type ManagedResearchFollowupsCommand,
} from "@research-cockpit/contracts";
import {
  createManagedWorkspaceHandler,
  type ManagedWorkspaceHandlerOptions,
} from "./managed-workspace-handler";
import type { ClerkTrialAuth } from "./clerk-trial-auth";
import type { ManagedCatalogService } from "./managed-workspace-catalog";
import {
  ResearchFollowupsRepositoryError,
  type ResearchFollowupsRepository,
  type ResearchFollowupsRecord,
  type ResearchFollowupsReceipt,
} from "./research-followups-repository";

const path = "/v1/managed/research-followups";
const principal = { userId: "invented-followups-owner" };
function command(): ManagedResearchFollowupsCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-followups-key",
    payload: { schemaVersion: 1, entries: [] },
  };
}
function receipt(input = command()): ResearchFollowupsReceipt {
  return {
    id: "main",
    version: input.expectedVersion + 1,
    digestSha256: createHash("sha256")
      .update(encodeResearchFollowupsPayload(input.payload))
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
      origin: "https://app.investingpro.app",
      authorization: "Bearer invented-session",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
}
function fixture() {
  const auth = vi
    .fn<ClerkTrialAuth>()
    .mockResolvedValue({ status: "allowed", principal });
  const get = vi
    .fn<ResearchFollowupsRepository["get"]>()
    .mockResolvedValue(null);
  const put = vi
    .fn<ResearchFollowupsRepository["put"]>()
    .mockImplementation((_principal, input) => Promise.resolve(receipt(input)));
  const close = vi.fn<() => Promise<void>>().mockResolvedValue();
  const openFollowupsRepository = vi.fn<
    ManagedWorkspaceHandlerOptions["openFollowupsRepository"]
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
  const catalog: ManagedCatalogService = {
    status: catalogStatus,
    search: vi.fn(),
    resolve: vi.fn(),
  };
  const handler = createManagedWorkspaceHandler({
    auth,
    catalog,
    openRepository,
    openFollowupsRepository,
  });
  return {
    handler,
    auth,
    get,
    put,
    close,
    openFollowupsRepository,
    openRepository,
    catalog,
    catalogStatus,
  };
}
async function json(response: Response) {
  return (await response.json()) as unknown;
}

it("reads a missing resource as empty version zero without creating rows or accessing watchlist/catalog", async () => {
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
    expect(f.openFollowupsRepository).not.toHaveBeenCalled();
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
  expect(f.openFollowupsRepository).not.toHaveBeenCalled();
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
    expect(f.openFollowupsRepository).not.toHaveBeenCalled();
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
      origin: "https://app.investingpro.app",
      "content-type": "text/plain",
    },
    body: "{}",
  });
  expect((await f.handler(wrongType)).status).toBe(415);
  expect(f.openFollowupsRepository).not.toHaveBeenCalled();
});
it.each(["id", "version", "payload"])(
  "refuses a malformed stored %s",
  async (field) => {
    const f = fixture();
    const record: ResearchFollowupsRecord = {
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
    f.put.mockRejectedValue(new ResearchFollowupsRepositoryError(code));
    const response = await f.handler(request("POST", command()));
    expect(response.status).toBe(status);
    expect(await json(response)).toEqual({ error: code });
    expect(f.close).toHaveBeenCalledOnce();
  },
);
it("closes an operation returned after request retirement without dispatching a write", async () => {
  const f = fixture(),
    abort = new AbortController(),
    held = deferred<Awaited<ReturnType<typeof f.openFollowupsRepository>>>();
  f.openFollowupsRepository.mockReturnValue(held.promise);
  const pending = f.handler(request("POST", command(), abort.signal));
  await vi.waitFor(() =>
    expect(f.openFollowupsRepository).toHaveBeenCalledOnce(),
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
    held = deferred<ResearchFollowupsReceipt>();
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
