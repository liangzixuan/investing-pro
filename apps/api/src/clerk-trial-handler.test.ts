import { describe, expect, it, vi } from "vitest";

import type { ClerkTrialAuth } from "./clerk-trial-auth";
import { toClerkTrialPayload } from "./clerk-trial-catalog";
import { createClerkTrialHandler } from "./clerk-trial-handler";
import {
  WatchlistRepositoryError,
  type MainWatchlistRecord,
  type PutMainWatchlistCommand,
} from "./watchlist-repository";

const ORIGIN = "https://trial.example.invalid";
const OWNER = { userId: "clerk-synthetic-owner" };
const COMMAND = {
  expectedVersion: 0,
  idempotencyKey: "synthetic-command-one",
  selected: ["DEMO_A", "DEMO_B"],
  note: "Invented note",
};
function fixture() {
  let record: MainWatchlistRecord | null = null;
  const receipts = new Map<string, { command: string; version: number }>();
  const auth = vi
    .fn<ClerkTrialAuth>()
    .mockResolvedValue({ status: "allowed", principal: OWNER });
  const close = vi.fn(() => Promise.resolve());
  const get = vi.fn(() => Promise.resolve(record));
  const put = vi.fn((principal: unknown, command: PutMainWatchlistCommand) =>
    Promise.resolve().then(() => {
      expect(principal).toEqual(OWNER);
      const saved = receipts.get(command.idempotencyKey);
      if (saved && saved.command !== JSON.stringify(command))
        throw new WatchlistRepositoryError("idempotency_conflict");
      if (!saved && command.expectedVersion !== (record?.version ?? 0))
        throw new WatchlistRepositoryError("conflict");
      const version = saved?.version ?? command.expectedVersion + 1;
      if (!saved) {
        record = {
          id: "main",
          version,
          payload: command.payload,
          createdAt: "2026-09-29T00:00:00.000Z",
          updatedAt: "2026-09-29T00:00:00.000Z",
        };
        receipts.set(command.idempotencyKey, {
          command: JSON.stringify(command),
          version,
        });
      }
      return {
        id: "main" as const,
        version,
        replayed: !!saved,
        digestSha256: "0".repeat(64),
        committedAt: "2026-09-29T00:00:00.000Z",
      };
    }),
  );
  const openRepository = vi.fn(() =>
    Promise.resolve({
      repository: { get, put },
      close,
    }),
  );
  const handler = createClerkTrialHandler({
    auth,
    allowedOrigins: [ORIGIN],
    openRepository,
  });
  return { handler, auth, openRepository, get, put, close };
}
function request(
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
  path = "watchlist",
) {
  return new Request(`https://api.example.invalid/v1/trial/${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("isolated Clerk trial request handler", () => {
  it("checks session without opening storage or returning user identity", async () => {
    const f = fixture();
    const response = await f.handler(request("GET", undefined, {}, "session"));
    expect(await response.json()).toEqual({ signedIn: true, allowed: true });
    expect(f.openRepository).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["null", "https://other.example.invalid", `${ORIGIN}/`])(
    "rejects exact-origin mismatch %s before auth/storage",
    async (origin) => {
      const f = fixture();
      const r = await f.handler(request("POST", COMMAND, { origin }));
      expect(r.status).toBe(403);
      expect(r.headers.has("access-control-allow-origin")).toBe(false);
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
  it("rejects absent origin", async () => {
    const f = fixture();
    const r = request();
    r.headers.delete("origin");
    expect((await f.handler(r)).status).toBe(403);
  });
  it.each(["unauthenticated", "access_denied"] as const)(
    "rejects %s before storage",
    async (status) => {
      const f = fixture();
      f.auth.mockResolvedValue({ status });
      const r = await f.handler(request("POST", COMMAND));
      expect(r.status).toBe(status === "unauthenticated" ? 401 : 403);
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
  it("allows only the declared preflight method and headers without authentication", async () => {
    const f = fixture();
    const r = await f.handler(
      request("OPTIONS", undefined, {
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      }),
    );
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(r.headers.has("access-control-allow-credentials")).toBe(false);
    expect(f.auth).not.toHaveBeenCalled();
    expect(
      (
        await f.handler(
          request("OPTIONS", undefined, {
            "access-control-request-method": "DELETE",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it.each([
    ["GET", "unknown", 404, "not_found"],
    ["GET", "watchlist/", 404, "not_found"],
    ["GET", "watchlist?extra=1", 404, "not_found"],
    ["GET", "session#extra", 404, "not_found"],
    ["OPTIONS", "unknown", 404, "not_found"],
    ["POST", "session", 405, "method_not_allowed"],
    ["PUT", "watchlist", 405, "method_not_allowed"],
    ["DELETE", "watchlist", 405, "method_not_allowed"],
  ] as const)(
    "rejects %s %s before authentication or storage",
    async (method, path, status, error) => {
      const f = fixture();
      const r = await f.handler(request(method, undefined, {}, path));
      expect(r.status).toBe(status);
      expect(await r.json()).toEqual({ error });
      expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(r.headers.get("vary")).toBe("Origin");
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["session", "GET", "Authorization", 204, "GET"],
    ["watchlist", "GET", "", 204, "GET, POST"],
    ["watchlist", "POST", " Content-Type, AUTHORIZATION ", 204, "GET, POST"],
    ["session", "POST", "authorization", 403, null],
    ["watchlist", "", "authorization", 403, null],
    ["watchlist", "GET", "authorization, x-owner", 403, null],
  ] as const)(
    "bounds preflight for %s with method %s and headers %s",
    async (path, method, headers, status, methods) => {
      const f = fixture();
      const r = await f.handler(
        request(
          "OPTIONS",
          undefined,
          {
            "access-control-request-method": method,
            "access-control-request-headers": headers,
          },
          path,
        ),
      );
      expect(r.status).toBe(status);
      expect(r.headers.get("access-control-allow-methods")).toBe(methods);
      expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(r.headers.has("access-control-allow-credentials")).toBe(false);
      expect(await r.text()).toBe(
        status === 204 ? "" : '{"error":"origin_denied"}',
      );
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
  it("round trips absence, save, replay and fresh read with server-only principal", async () => {
    const f = fixture();
    expect(await (await f.handler(request())).json()).toEqual({
      version: 0,
      selected: [],
      note: "",
    });
    expect(await (await f.handler(request("POST", COMMAND))).json()).toEqual({
      version: 1,
      selected: COMMAND.selected,
      note: COMMAND.note,
      replayed: false,
    });
    expect(await (await f.handler(request("POST", COMMAND))).json()).toEqual({
      version: 1,
      selected: COMMAND.selected,
      note: COMMAND.note,
      replayed: true,
    });
    expect(await (await f.handler(request())).json()).toEqual({
      version: 1,
      selected: COMMAND.selected,
      note: COMMAND.note,
    });
    expect(f.get).toHaveBeenCalledWith(OWNER);
    expect(f.close).toHaveBeenCalledTimes(4);
  });
  it("keeps conflict and key reuse distinct without retrying", async () => {
    const f = fixture();
    await f.handler(request("POST", COMMAND));
    expect(
      await (
        await f.handler(
          request("POST", {
            ...COMMAND,
            idempotencyKey: "synthetic-command-two",
          }),
        )
      ).json(),
    ).toEqual({ error: "conflict" });
    expect(
      await (
        await f.handler(request("POST", { ...COMMAND, note: "Changed" }))
      ).json(),
    ).toEqual({ error: "idempotency_conflict" });
    expect(f.put).toHaveBeenCalledTimes(3);
    expect(f.close).toHaveBeenCalledTimes(3);
  });
  it("returns an old command receipt on replay and the latest state only on GET", async () => {
    const f = fixture();
    await f.handler(request("POST", COMMAND));
    const next = {
      ...COMMAND,
      expectedVersion: 1,
      idempotencyKey: "synthetic-command-two",
      selected: ["DEMO_A"],
      note: "Newer invented note",
    };
    await f.handler(request("POST", next));
    expect(await (await f.handler(request("POST", COMMAND))).json()).toEqual({
      version: 1,
      selected: COMMAND.selected,
      note: COMMAND.note,
      replayed: true,
    });
    expect(await (await f.handler(request())).json()).toEqual({
      version: 2,
      selected: next.selected,
      note: next.note,
    });
    expect(f.put).toHaveBeenCalledTimes(3);
    expect(f.get).toHaveBeenCalledTimes(1);
    expect(f.close).toHaveBeenCalledTimes(4);
  });
  it.each([
    { ...COMMAND, userId: "attacker" },
    { ...COMMAND, ownerId: "attacker" },
    { ...COMMAND, expectedVersion: -1 },
    { ...COMMAND, idempotencyKey: "short" },
    { ...COMMAND, selected: ["DEMO_B", "DEMO_A"] },
    { ...COMMAND, selected: ["AAPL"] },
    { ...COMMAND, note: "note\ncontrol" },
  ])(
    "rejects invalid closed command %# before opening storage",
    async (body) => {
      const f = fixture();
      expect((await f.handler(request("POST", body))).status).toBe(400);
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
  it("bounds actual bytes independently of content-length", async () => {
    const f = fixture();
    expect(
      (await f.handler(request("POST", { ...COMMAND, note: "x".repeat(9000) })))
        .status,
    ).toBe(413);
    expect(f.openRepository).not.toHaveBeenCalled();
  });
  it("rejects unsupported content type and content encoding", async () => {
    const f = fixture();
    expect(
      (
        await f.handler(
          request("POST", COMMAND, { "content-type": "text/plain" }),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await f.handler(
          request("POST", COMMAND, { "content-encoding": "gzip" }),
        )
      ).status,
    ).toBe(415);
  });
  it.each([
    "invalid_request",
    "conflict",
    "idempotency_conflict",
    "commit_unknown",
    "unavailable",
    "access_denied",
    "invalid_response",
  ] as const)(
    "preserves finite repository failure %s and closes exactly once",
    async (code) => {
      const f = fixture();
      f.put.mockRejectedValue(new WatchlistRepositoryError(code));
      const r = await f.handler(request("POST", COMMAND));
      expect(r.status).toBe(
        {
          invalid_request: 400,
          access_denied: 403,
          conflict: 409,
          idempotency_conflict: 409,
          commit_unknown: 503,
          unavailable: 503,
          invalid_response: 503,
        }[code],
      );
      expect(await r.json()).toEqual({
        error: code === "invalid_response" ? "commit_unknown" : code,
      });
      expect(f.put).toHaveBeenCalledTimes(1);
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it("reports unexpected write/cleanup failures as unknown without exposing their bodies", async () => {
    const f = fixture();
    f.close.mockRejectedValue(new Error("credential=do-not-return"));
    const r = await f.handler(request("POST", COMMAND));
    expect(r.status).toBe(503);
    expect(await r.text()).toBe('{"error":"commit_unknown"}');
    expect(f.put).toHaveBeenCalledTimes(1);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["GET", "success", "unavailable"],
    ["GET", "access_denied", "unavailable"],
    ["POST", "conflict", "commit_unknown"],
    ["POST", "unexpected", "commit_unknown"],
  ] as const)(
    "lets cleanup failure override %s %s without retrying",
    async (method, outcome, error) => {
      const f = fixture();
      if (outcome === "access_denied")
        f.get.mockRejectedValue(new WatchlistRepositoryError("access_denied"));
      if (outcome === "conflict")
        f.put.mockRejectedValue(new WatchlistRepositoryError("conflict"));
      if (outcome === "unexpected")
        f.put.mockRejectedValue(new Error("untrusted upstream details"));
      f.close.mockRejectedValue(new Error("private cleanup details"));
      const r = await f.handler(
        request(method, method === "POST" ? COMMAND : undefined),
      );
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error });
      expect(f.get).toHaveBeenCalledTimes(method === "GET" ? 1 : 0);
      expect(f.put).toHaveBeenCalledTimes(method === "POST" ? 1 : 0);
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["GET", "POST"])(
    "reports an unexpected %s data failure without leaking details",
    async (method) => {
      const f = fixture();
      f.get.mockRejectedValue(new Error("private read details"));
      f.put.mockRejectedValue(new Error("private write details"));
      const r = await f.handler(
        request(method, method === "POST" ? COMMAND : undefined),
      );
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({
        error: method === "POST" ? "commit_unknown" : "unavailable",
      });
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it("does not call close or mark a write started when repository acquisition fails", async () => {
    const f = fixture();
    f.openRepository.mockRejectedValue(
      new Error("private acquisition details"),
    );
    const r = await f.handler(request("POST", COMMAND));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "unavailable" });
    expect(f.openRepository).toHaveBeenCalledTimes(1);
    expect(f.get).not.toHaveBeenCalled();
    expect(f.put).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
  });
  it.each([
    { id: "other" },
    { version: 0 },
    { version: 1.5 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { version: "1" },
  ])("rejects malformed read metadata %# and closes storage", async (patch) => {
    const f = fixture();
    f.get.mockResolvedValue({
      id: "main",
      version: 1,
      payload: toClerkTrialPayload(["DEMO_A"], ""),
      createdAt: "",
      updatedAt: "",
      ...patch,
    } as MainWatchlistRecord);
    const r = await f.handler(request());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "unavailable" });
    expect(f.get).toHaveBeenCalledTimes(1);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it.each([
    { id: "other" },
    { version: 0 },
    { version: 2 },
    { version: 1.5 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { version: "1" },
    { replayed: "false" },
  ])("treats malformed write receipt %# as uncertain", async (patch) => {
    const f = fixture();
    f.put.mockResolvedValue({
      id: "main",
      version: 1,
      replayed: false,
      digestSha256: "0".repeat(64),
      committedAt: "2026-09-29T00:00:00.000Z",
      ...patch,
    } as Awaited<ReturnType<typeof f.put>>);
    const r = await f.handler(request("POST", COMMAND));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "commit_unknown" });
    expect(f.put).toHaveBeenCalledTimes(1);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("rejects stored foreign data instead of silently omitting members", async () => {
    const f = fixture();
    const payload = toClerkTrialPayload(["DEMO_A"], "");
    f.get.mockResolvedValue({
      id: "main",
      version: 1,
      payload: { ...payload, snapshotSha256: `sha256:${"0".repeat(64)}` },
      createdAt: "",
      updatedAt: "",
    });
    expect(await (await f.handler(request())).json()).toEqual({
      error: "unavailable",
    });
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("rejects an already aborted save before opening storage", async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    const r = new Request(request("POST", COMMAND), {
      signal: controller.signal,
    });
    expect((await f.handler(r)).status).toBe(408);
    expect(f.openRepository).not.toHaveBeenCalled();
  });
  it("stops after authentication if the request was aborted during auth", async () => {
    const f = fixture();
    const controller = new AbortController();
    const r = new Request(request("POST", COMMAND), {
      signal: controller.signal,
    });
    f.auth.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve({ status: "allowed", principal: OWNER });
    });
    const response = await f.handler(r);
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: "request_timeout" });
    expect(r.bodyUsed).toBe(false);
    expect(f.openRepository).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
  });
  it("stops after body completion if the request was aborted while reading", async () => {
    const f = fixture();
    const controller = new AbortController();
    const pull = vi.fn(
      (stream: ReadableStreamDefaultController<Uint8Array>) => {
        expect(f.auth).toHaveBeenCalledTimes(1);
        controller.abort();
        stream.enqueue(new TextEncoder().encode(JSON.stringify(COMMAND)));
        stream.close();
      },
    );
    const r = new Request("https://api.example.invalid/v1/trial/watchlist", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 }),
      signal: controller.signal,
      duplex: "half",
    } as RequestInit);
    const response = await f.handler(r);
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: "request_timeout" });
    expect(pull).toHaveBeenCalledTimes(1);
    expect(r.bodyUsed).toBe(true);
    expect(f.openRepository).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
  });
  it.each(["GET", "POST"])(
    "closes an acquired %s operation without a data call when acquisition finishes after abort",
    async (method) => {
      const f = fixture();
      const controller = new AbortController();
      f.openRepository.mockImplementationOnce(() => {
        controller.abort();
        return Promise.resolve({
          repository: { get: f.get, put: f.put },
          close: f.close,
        });
      });
      const r = new Request(
        request(method, method === "POST" ? COMMAND : undefined),
        { signal: controller.signal },
      );
      const response = await f.handler(r);
      expect(response.status).toBe(408);
      expect(await response.json()).toEqual({ error: "request_timeout" });
      expect(f.openRepository).toHaveBeenCalledTimes(1);
      expect(f.get).not.toHaveBeenCalled();
      expect(f.put).not.toHaveBeenCalled();
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it("times out a stalled body and never opens storage", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture();
      const r = new Request("https://api.example.invalid/v1/trial/watchlist", {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: new ReadableStream<Uint8Array>(),
        duplex: "half",
      } as RequestInit);
      const pending = f.handler(r);
      await vi.advanceTimersByTimeAsync(2001);
      expect((await pending).status).toBe(408);
      expect(f.openRepository).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
