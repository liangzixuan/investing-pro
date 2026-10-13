import {
  MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS,
  MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedApi } from "./managed-api";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import type { TrialSession } from "./session";

function fixture() {
  const session: TrialSession = {
    userId: "invented",
    sessionId: "invented",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("invented-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  return {
    session,
    fetcher,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
    abort: new AbortController(),
  };
}
afterEach(() => vi.useRealTimers());

describe("managed Federal Reserve transport", () => {
  it("makes only the explicit authenticated body-free request and owns frozen metadata", async () => {
    const f = fixture();
    const wire = fedAnnouncementsFixture();
    f.fetcher.mockResolvedValue(Response.json(wire));
    expect(f.fetcher).not.toHaveBeenCalled();
    const result = await f.api.monetaryAnnouncements(f.abort.signal);
    expect(f.fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://managed.example.invalid${MANAGED_MONETARY_ANNOUNCEMENTS_PATH}`,
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer invented-token" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      }),
    );
    expect(f.fetcher.mock.calls[0]![1]!.body).toBeUndefined();
    expect(result).toEqual(wire);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.source)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
  });
  it.each([
    [408, { error: "request_timeout" }, "unavailable"],
    [503, { error: "unavailable" }, "unavailable"],
    [401, { error: "unauthenticated" }, "unauthenticated"],
    [403, { error: "access_denied" }, "access_denied"],
    [409, { error: "catalog_changed" }, "invalid_response"],
    [429, { error: "rate_limited" }, "invalid_response"],
    [503, { error: "commit_unknown" }, "invalid_response"],
    [408, { error: "request_timeout", extra: true }, "invalid_response"],
  ] as const)(
    "checks status %s and exact envelope %j",
    async (status, body, code) => {
      const f = fixture();
      f.fetcher.mockResolvedValue(Response.json(body, { status }));
      await expect(
        f.api.monetaryAnnouncements(f.abort.signal),
      ).rejects.toMatchObject({ code });
    },
  );
  it.each(["source", "article", "extra", "bytes", "utf8"])(
    "rejects invalid %s before returning data",
    async (kind) => {
      const f = fixture();
      const wire = fedAnnouncementsFixture();
      let response: Response;
      if (kind === "bytes")
        response = new Response(
          " ".repeat(MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.responseBytes + 1),
          { headers: { "content-type": "application/json" } },
        );
      else if (kind === "utf8")
        response = new Response(new Uint8Array([0xc0, 0xaf]), {
          headers: { "content-type": "application/json" },
        });
      else
        response = Response.json(
          kind === "source"
            ? {
                ...wire,
                source: {
                  ...wire.source,
                  feedUrl: "https://unreviewed.invalid",
                },
              }
            : kind === "article"
              ? {
                  ...wire,
                  items: [
                    { ...wire.items[0], url: "https://unreviewed.invalid" },
                  ],
                }
              : { ...wire, extra: true },
        );
      f.fetcher.mockResolvedValue(response);
      await expect(
        f.api.monetaryAnnouncements(f.abort.signal),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it.each(["abort", "timeout"])(
    "bounds a held token on %s without starting a request",
    async (boundary) => {
      vi.useFakeTimers();
      const f = fixture();
      let finish!: (token: string) => void;
      vi.mocked(f.session.getToken).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const pending = f.api.monetaryAnnouncements(f.abort.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: boundary === "abort" ? "aborted" : "unavailable",
      });
      if (boundary === "abort") f.abort.abort();
      else await vi.advanceTimersByTimeAsync(20_000);
      await rejected;
      finish("invented-late-token");
      await Promise.resolve();
      expect(f.fetcher).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("aborts a held response and ignores its late successful body", async () => {
    const f = fixture();
    let finish!: (response: Response) => void;
    f.fetcher.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = f.api.monetaryAnnouncements(f.abort.signal);
    await Promise.resolve();
    f.abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    finish(Response.json(fedAnnouncementsFixture()));
    await Promise.resolve();
    expect(f.fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });
});
