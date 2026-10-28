import { afterEach, describe, expect, it, vi } from "vitest";
import { MANAGED_CPI_HEADLINE_SOURCE } from "@research-cockpit/contracts";
import { createCpiHeadlinesProvider } from "./cpi-headlines-provider";
import { cpiAtom, CPI_FETCHED_AT } from "./test-cpi-headlines-fixture";
afterEach(() => vi.useRealTimers());
function provider(fetch: typeof globalThis.fetch) {
  return createCpiHeadlinesProvider({
    fetch,
    now: () => new Date(CPI_FETCHED_AT),
  });
}
describe("fixed CPI headline source transport", () => {
  it("constructs passively and makes one credential-free fixed request without linked fetches", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(cpiAtom()));
    const source = provider(fetch);
    expect(fetch).not.toHaveBeenCalled();
    const result = await source.load();
    expect(result.fetchedAt).toBe(CPI_FETCHED_AT);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      MANAGED_CPI_HEADLINE_SOURCE.feedUrl,
      {
        method: "GET",
        headers: {
          Accept:
            "application/atom+xml, application/rss+xml;q=0.9, application/xml;q=0.8",
        },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    source.close();
    await expect(source.load()).rejects.toMatchObject({ code: "aborted" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([301, 403, 404, 429, 500])(
    "does not retry status %s or expose response bodies",
    async (status) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response("PRIVATE-SOURCE", { status }));
      await expect(provider(fetch).load()).rejects.toMatchObject({
        code: "unavailable",
        message: "CPI headlines unavailable",
      });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
  it("refuses a redirected200 response without fetching its target", async () => {
    const response = new Response(cpiAtom());
    Object.defineProperty(response, "redirected", { value: true });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
    await expect(provider(fetch).load()).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["262145", "-1", "1.5", "invalid"])(
    "refuses Content-Length %s before reading",
    async (length) => {
      const cancel = vi.fn(),
        pull = vi.fn();
      const response = new Response(
        new ReadableStream<Uint8Array>({ pull, cancel }),
        { headers: { "content-length": length } },
      );
      await expect(
        provider(
          vi.fn<typeof globalThis.fetch>().mockResolvedValue(response),
        ).load(),
      ).rejects.toMatchObject({ code: "invalid_response" });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
  it.each([
    new Uint8Array(),
    new Uint8Array([0xc3, 0x28]),
    new TextEncoder().encode("x".repeat(262145)),
  ])(
    "refuses empty, invalid UTF8 or oversized streamed bytes",
    async (bytes) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(bytes));
      await expect(provider(fetch).load()).rejects.toMatchObject({
        code: "invalid_response",
      });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
  it("aborts an uncooperative fetch at10 seconds and clears its timer", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise(() => undefined),
    );
    const loading = provider(fetch).load(),
      rejected = expect(loading).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect((fetch.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pre-aborts without IO and closes active blocked body reads without late publication", async () => {
    const caller = new AbortController();
    caller.abort();
    const unused = vi.fn<typeof globalThis.fetch>();
    await expect(provider(unused).load(caller.signal)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(unused).not.toHaveBeenCalled();
    const cancel = vi.fn(),
      fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          new Response(new ReadableStream({ pull() {}, cancel })),
        );
    const source = provider(fetch),
      loading = source.load(),
      rejected = expect(loading).rejects.toMatchObject({ code: "aborted" });
    await Promise.resolve();
    await Promise.resolve();
    source.close();
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("sanitizes fetch and parse exceptions, including private source excerpts", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error("PRIVATE-SOURCE"));
    await expect(provider(fetch).load()).rejects.toMatchObject({
      code: "unavailable",
      message: "CPI headlines unavailable",
    });
    await expect(
      provider(
        vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValue(new Response("<private source")),
      ).load(),
    ).rejects.toMatchObject({
      code: "invalid_response",
      message: "CPI headlines unavailable",
    });
  });
});
