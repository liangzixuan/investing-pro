import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlsReleaseProvider } from "./bls-release-provider";
const NOW = "2026-10-20T00:00:00.000Z";
const ICS =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invented\r\nDTSTART:20261021T140000Z\r\nSUMMARY:Invented release\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
afterEach(() => vi.useRealTimers());

describe("BLS fixed public provider", () => {
  it("performs no startup IO and uses exactly one credential-free request", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(ICS)));
    const provider = createBlsReleaseProvider({
      fetch,
      now: () => new Date(NOW),
    });
    expect(fetch).not.toHaveBeenCalled();
    const result = await provider.load();
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://www.bls.gov/schedule/news_release/bls.ics",
      {
        method: "GET",
        headers: { Accept: "text/calendar" },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(result.events).toEqual([
      { series: "Invented release", scheduledAt: "2026-10-21T14:00:00.000Z" },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    provider.close();
    await expect(provider.load()).rejects.toMatchObject({ code: "aborted" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("records retrieval time after the complete body arrives", async () => {
    let clock = NOW;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ICS));
        clock = "2026-10-20T00:00:05.000Z";
        controller.close();
      },
    });
    const provider = createBlsReleaseProvider({
      fetch: () => Promise.resolve(new Response(stream)),
      now: () => new Date(clock),
    });
    expect((await provider.load()).fetchedAt).toBe(clock);
  });
  it.each([
    new Response("", { status: 302 }),
    new Response("", { status: 500 }),
  ])("refuses HTTP failure without retry", async (response) => {
    const fetch = vi.fn(() => Promise.resolve(response));
    const provider = createBlsReleaseProvider({ fetch });
    await expect(provider.load()).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([
    new Response(ICS, { headers: { "content-length": "262145" } }),
    new Response(ICS, { headers: { "content-length": "invalid" } }),
    new Response("x".repeat(262145)),
    new Response(new Uint8Array([255])),
    new Response(""),
    new Response("not ICS"),
  ])(
    "refuses oversized, malformed or empty complete bodies",
    async (response) => {
      await expect(
        createBlsReleaseProvider({
          fetch: () => Promise.resolve(response),
          now: () => new Date(NOW),
        }).load(),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it("bounds a fetch that ignores AbortSignal", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const provider = createBlsReleaseProvider({ fetch });
    const result = expect(provider.load()).rejects.toMatchObject({
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("bounds an unfinished body even after valid ICS bytes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ICS));
      },
      cancel,
    });
    const provider = createBlsReleaseProvider({
      fetch: () => Promise.resolve(new Response(body)),
    });
    const result = expect(provider.load()).rejects.toMatchObject({
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("caller abort and close stop all pending work without late publication", async () => {
    const provider = createBlsReleaseProvider({
      fetch: () => new Promise<Response>(() => undefined),
    });
    const controller = new AbortController();
    const first = expect(
      provider.load(controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    controller.abort();
    await first;
    const second = expect(provider.load()).rejects.toMatchObject({
      code: "aborted",
    });
    const third = expect(provider.load()).rejects.toMatchObject({
      code: "aborted",
    });
    provider.close();
    await Promise.all([second, third]);
  });
});
