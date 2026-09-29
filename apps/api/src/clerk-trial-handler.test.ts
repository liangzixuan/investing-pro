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
