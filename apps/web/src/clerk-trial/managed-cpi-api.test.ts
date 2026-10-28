import { afterEach, it, expect, vi } from "vitest";
import {
  MANAGED_CPI_HEADLINES_PATH,
  MANAGED_CPI_HEADLINES_LIMITS,
} from "@research-cockpit/contracts";
import { createManagedApi } from "./managed-api";
import type { TrialSession } from "./session";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
function held<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture() {
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("invented-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(cpiHeadlinesFixture()));
  return {
    session,
    fetcher,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
  };
}
afterEach(() => {
  vi.useRealTimers();
});
it("reads only the fixed authenticated route explicitly, preserving full raw clocks and source ownership", async () => {
  const f = fixture();
  expect(f.fetcher).not.toHaveBeenCalled();
  const result = await f.api.cpiHeadlines();
  expect(f.fetcher).toHaveBeenCalledOnce();
  expect(f.fetcher.mock.calls[0]![0]).toBe(
    "https://managed.example.invalid" + MANAGED_CPI_HEADLINES_PATH,
  );
  expect(f.fetcher.mock.calls[0]![1]).toMatchObject({
    method: "GET",
    headers: { Authorization: "Bearer invented-token" },
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  expect(f.fetcher.mock.calls[0]![1]!.body).toBeUndefined();
  expect(result).toEqual(cpiHeadlinesFixture());
  expect(Object.isFrozen(result.items[0])).toBe(true);
});
it.each([
  [408, { error: "request_timeout" }, "unavailable"],
  [503, { error: "unavailable" }, "unavailable"],
  [401, { error: "unauthenticated" }, "unauthenticated"],
  [403, { error: "access_denied" }, "access_denied"],
  [
    503,
    { error: "unavailable", body: "secret source text" },
    "invalid_response",
  ],
  [409, { error: "catalog_changed" }, "invalid_response"],
] as const)(
  "admits only known error status/body %s",
  async (status, value, code) => {
    const f = fixture();
    f.fetcher.mockResolvedValueOnce(Response.json(value, { status }));
    await expect(f.api.cpiHeadlines()).rejects.toMatchObject({
      code,
      message: code,
    });
    expect(f.fetcher).toHaveBeenCalledOnce();
  },
);
it.each(["schema", "source", "clock", "duplicate", "oversize"] as const)(
  "refuses malformed complete CPI response: %s",
  async (kind) => {
    const f = fixture();
    const v = cpiHeadlinesFixture();
    let response: Response;
    if (kind === "schema") response = Response.json({ ...v, extra: true });
    else if (kind === "source")
      response = Response.json({
        ...v,
        source: { ...v.source, feedUrl: "https://unexpected.invalid/feed" },
      });
    else if (kind === "clock")
      response = Response.json({
        ...v,
        items: [{ ...v.items[0]!, updatedAt: "2026-10-01" }],
      });
    else if (kind === "duplicate")
      response = Response.json({ ...v, items: [v.items[0], v.items[0]] });
    else
      response = new Response(
        " ".repeat(MANAGED_CPI_HEADLINES_LIMITS.responseBytes + 1),
        { headers: { "content-type": "application/json" } },
      );
    f.fetcher.mockResolvedValueOnce(response);
    await expect(f.api.cpiHeadlines()).rejects.toMatchObject({
      code: "invalid_response",
    });
  },
);
it("cancels one held request and does not adopt its late response or retry", async () => {
  const f = fixture();
  const r = held<Response>();
  f.fetcher.mockReturnValueOnce(r.promise);
  const abort = new AbortController();
  const pending = f.api.cpiHeadlines(abort.signal);
  await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledOnce());
  abort.abort();
  await expect(pending).rejects.toMatchObject({ code: "aborted" });
  r.resolve(Response.json(cpiHeadlinesFixture()));
  expect(f.fetcher).toHaveBeenCalledOnce();
  expect(f.fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
});
it.each(["token", "fetch", "body"] as const)(
  "bounds the total explicit read at10seconds including %s",
  async (stage) => {
    vi.useFakeTimers();
    const f = fixture();
    const token = held<string | null>();
    const fetch = held<Response>();
    const cancel = vi.fn();
    if (stage === "token")
      vi.mocked(f.session.getToken).mockReturnValueOnce(token.promise);
    if (stage === "fetch") f.fetcher.mockReturnValueOnce(fetch.promise);
    if (stage === "body")
      f.fetcher.mockResolvedValueOnce(
        new Response(new ReadableStream({ cancel }), {
          headers: { "content-type": "application/json" },
        }),
      );
    const pending = f.api.cpiHeadlines();
    const refused = expect(pending).rejects.toMatchObject({
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(9999);
    if (stage !== "token") expect(f.fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await refused;
    if (stage === "body") expect(cancel).toHaveBeenCalled();
    token.resolve("invented-token");
    fetch.resolve(Response.json(cpiHeadlinesFixture()));
    await Promise.resolve();
    expect(f.fetcher).toHaveBeenCalledTimes(stage === "token" ? 0 : 1);
  },
);
