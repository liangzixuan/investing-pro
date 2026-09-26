import { isPersonalEconomicCalendarDto } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBeaReleaseProvider } from "./bea-release-provider";

const NOW = "2026-09-26T12:00:00.000Z";
const DATE = "2026-09-27T12:30:00+00:00";
const schedule = (dates: unknown[] = [DATE]) => ({
  GDP: { release_dates: dates },
});
const response = (value: unknown) => new Response(JSON.stringify(value));
function fixture(value: unknown = schedule()) {
  const fetch = vi.fn(() => Promise.resolve(response(value)));
  const provider = createBeaReleaseProvider({
    fetch,
    now: () => new Date(NOW),
  });
  return { fetch, provider };
}

afterEach(() => vi.useRealTimers());

describe("BEA public release schedule provider", () => {
  it("performs no startup IO, then uses one fixed credential-free request", async () => {
    const { fetch, provider } = fixture();
    expect(fetch).not.toHaveBeenCalled();
    const result = await provider.load();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://apps.bea.gov/API/signup/release_dates.json",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(isPersonalEconomicCalendarDto(result)).toBe(true);
    expect(result.window).toEqual({
      fromInclusive: NOW,
      toExclusive: "2026-10-26T12:00:00.000Z",
    });
    expect(result.events).toEqual([
      { series: "GDP", scheduledAt: "2026-09-27T12:30:00.000Z" },
    ]);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    provider.close();
  });

  it("deduplicates exact series/instant pairs but retains simultaneous different series", async () => {
    const { provider } = fixture({
      Zulu: {
        release_dates: [
          DATE,
          "2026-09-27T08:30:00-04:00",
          "2026-09-28T12:30:00Z",
        ],
      },
      Alpha: { release_dates: [DATE] },
    });
    expect((await provider.load()).events).toEqual([
      { series: "Alpha", scheduledAt: "2026-09-27T12:30:00.000Z" },
      { series: "Zulu", scheduledAt: "2026-09-27T12:30:00.000Z" },
      { series: "Zulu", scheduledAt: "2026-09-28T12:30:00.000Z" },
    ]);
  });

  it("filters an inclusive beginning and exclusive end without claiming missing events", async () => {
    const { provider } = fixture(
      schedule([
        "2026-09-26T11:59:59Z",
        NOW,
        "2026-10-26T11:59:59.999Z",
        "2026-10-26T12:00:00Z",
      ]),
    );
    expect(
      (await provider.load()).events.map((event) => event.scheduledAt),
    ).toEqual([NOW, "2026-10-26T11:59:59.999Z"]);
    expect(
      (await fixture(schedule(["2026-09-25T12:00:00Z"])).provider.load())
        .events,
    ).toEqual([]);
  });

  it("captures fetchedAt after the response body completes", async () => {
    let clock = new Date(NOW);
    const provider = createBeaReleaseProvider({
      fetch: () => {
        clock = new Date("2026-09-26T12:00:05.000Z");
        return Promise.resolve(response(schedule()));
      },
      now: () => clock,
    });
    expect((await provider.load()).fetchedAt).toBe(clock.toISOString());
  });

  it("validates and excludes BEA's unzoned file metadata from the agenda", async () => {
    const { provider } = fixture({
      ...schedule(),
      file_last_updated: "2026-07-13T08:00:42.402013",
    });
    const result = await provider.load();
    expect(result.events).toEqual([
      { series: "GDP", scheduledAt: "2026-09-27T12:30:00.000Z" },
    ]);
    expect(result.fetchedAt).toBe(NOW);
    expect(result).not.toHaveProperty("file_last_updated");
    for (const file_last_updated of [
      null,
      42,
      {},
      "2026-02-30T08:00:42",
      "2026-07-13T08:00:42.402013extra",
    ]) {
      await expect(
        fixture({ ...schedule(), file_last_updated }).provider.load(),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
    await expect(
      fixture({
        file_last_updated: "2026-07-13T08:00:42.402013",
      }).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    null,
    [],
    {},
    { GDP: { release_dates: [] } },
    { GDP: [] },
    { GDP: {} },
    { GDP: { release_dates: [], extra: true } },
    { GDP: { release_dates: "date" } },
    { "": { release_dates: [] } },
    { " GDP": { release_dates: [] } },
    { "G\nDP": { release_dates: [] } },
    { ["a".repeat(257)]: { release_dates: [] } },
  ])(
    "rejects malformed source shape %# without partial output",
    async (value) => {
      await expect(fixture(value).provider.load()).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it.each([
    null,
    42,
    "2026-09-27",
    "2026-02-30T12:30:00Z",
    "2026-09-27T24:00:00Z",
    "2026-09-27T12:30:00",
    "2026-09-27T12:30:00+25:00",
  ])(
    "rejects invalid dates %# even outside the visible window",
    async (date) => {
      await expect(
        fixture(schedule([DATE, date])).provider.load(),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("enforces input series/date and output event bounds", async () => {
    const tooManySeries = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [
        `Series ${index}`,
        { release_dates: [] },
      ]),
    );
    await expect(fixture(tooManySeries).provider.load()).rejects.toMatchObject({
      code: "invalid_response",
    });
    await expect(
      fixture(
        schedule(Array.from({ length: 4097 }, () => DATE)),
      ).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const dates = Array.from({ length: 513 }, (_, index) =>
      new Date(Date.parse(DATE) + index * 1000).toISOString(),
    );
    await expect(
      fixture(schedule(dates)).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(
      (await fixture(schedule(dates.slice(0, 512))).provider.load()).events,
    ).toHaveLength(512);
  });

  it.each([301, 400, 403, 429, 500])(
    "never retries upstream status %s",
    async (status) => {
      const fetch = vi.fn(() =>
        Promise.resolve(new Response("private-error-body", { status })),
      );
      const provider = createBeaReleaseProvider({ fetch });
      await expect(provider.load()).rejects.toMatchObject({
        code: "unavailable",
        message: "The BEA release schedule is unavailable.",
      });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("rejects declared and measured oversized bodies, invalid UTF-8 and malformed JSON", async () => {
    for (const response of [
      new Response("{}", { headers: { "content-length": "262145" } }),
      new Response("{}", { headers: { "content-length": "-1" } }),
      new Response("a".repeat(262145)),
      new Response(new Uint8Array([0xc3, 0x28])),
      new Response("not-json"),
      new Response(null),
    ]) {
      const provider = createBeaReleaseProvider({
        fetch: () => Promise.resolve(response),
      });
      await expect(provider.load()).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
  });

  it("honors an already cancelled call without fetch", async () => {
    const { fetch, provider } = fixture();
    const caller = new AbortController();
    caller.abort();
    await expect(provider.load(caller.signal)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds a fetch that ignores abort to the shared ten-second deadline", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const provider = createBeaReleaseProvider({ fetch });
    const completed = expect(provider.load()).rejects.toMatchObject({
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await completed;
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("uses the same deadline for a stalled response body", async () => {
    vi.useFakeTimers();
    const provider = createBeaReleaseProvider({
      fetch: () =>
        Promise.resolve(new Response(new ReadableStream({ start() {} }))),
    });
    const completed = expect(provider.load()).rejects.toMatchObject({
      code: "unavailable",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await completed;
  });

  it("aborts active work on caller cancellation and provider close", async () => {
    for (const action of ["caller", "close"] as const) {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const provider = createBeaReleaseProvider({ fetch });
      const caller = new AbortController();
      const completed = expect(
        provider.load(caller.signal),
      ).rejects.toMatchObject({ code: "aborted" });
      if (action === "caller") caller.abort();
      else provider.close();
      await completed;
      provider.close();
      await expect(provider.load()).rejects.toMatchObject({ code: "aborted" });
      expect(fetch).toHaveBeenCalledOnce();
    }
  });
});
