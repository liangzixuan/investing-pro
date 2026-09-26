import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPersonalEconomicCalendar } from "./personal-workspace-api";

const fetchMock = vi.fn<typeof fetch>();
function fixture(): PersonalEconomicCalendarDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: "2026-09-26T18:00:00.000Z",
    window: {
      fromInclusive: "2026-09-26T18:00:00.000Z",
      toExclusive: "2026-10-26T18:00:00.000Z",
    },
    events: [
      { series: "Synthetic GDP", scheduledAt: "2026-09-30T12:30:00.000Z" },
    ],
  };
}
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("economic calendar client", () => {
  it("uses one authenticated fixed local GET without a body and returns a deeply frozen copy", async () => {
    const input = fixture();
    fetchMock.mockResolvedValue(Response.json(input));
    const signal = new AbortController().signal;
    const result = await fetchPersonalEconomicCalendar(signal);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL("http://127.0.0.1:3100/v1/personal-filing/economic-calendar"),
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
      },
    );
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    for (const value of [
      result,
      result.source,
      result.window,
      result.events,
      result.events[0],
    ])
      expect(Object.isFrozen(value)).toBe(true);
  });
  it("accepts an empty verified window", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...fixture(), events: [] }));
    expect(
      (await fetchPersonalEconomicCalendar(new AbortController().signal))
        .events,
    ).toEqual([]);
  });
  it.each([
    { ...fixture(), extra: true },
    {
      ...fixture(),
      source: {
        ...PERSONAL_BEA_CALENDAR_SOURCE,
        scheduleUrl: "https://example.com",
      },
    },
    {
      ...fixture(),
      window: {
        ...fixture().window,
        fromInclusive: "2026-09-27T18:00:00.000Z",
      },
    },
    {
      ...fixture(),
      events: [
        { series: "Synthetic", scheduledAt: "2026-10-26T18:00:00.000Z" },
      ],
    },
    { ...fixture(), events: [fixture().events[0], fixture().events[0]] },
  ])("rejects a response outside the shared strict contract", async (value) => {
    fetchMock.mockResolvedValue(Response.json(value));
    await expect(
      fetchPersonalEconomicCalendar(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [403, "session_unavailable"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "provider_unavailable"],
    [500, "unavailable"],
  ])(
    "maps HTTP %s without reading or exposing the error body",
    async (status, code) => {
      const json = vi.fn(() => {
        throw new Error("Do not read rejected bodies");
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        json,
      } as unknown as Response);
      await expect(
        fetchPersonalEconomicCalendar(new AbortController().signal),
      ).rejects.toMatchObject({ code });
      expect(json).not.toHaveBeenCalled();
    },
  );
  it("turns malformed JSON into a safe typed error", async () => {
    fetchMock.mockResolvedValue(new Response("not json"));
    await expect(
      fetchPersonalEconomicCalendar(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("does not start an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchPersonalEconomicCalendar(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cancellation that occurs while reading a successful body", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => {
        controller.abort();
        return Promise.resolve(fixture());
      },
    } as Response);
    await expect(
      fetchPersonalEconomicCalendar(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("hides a transport failure without retrying", async () => {
    fetchMock.mockRejectedValue(new Error("private transport details"));
    await expect(
      fetchPersonalEconomicCalendar(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "unavailable",
      message: "The personal workspace request was not accepted.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("refuses a controlling service worker before any request", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    await expect(
      fetchPersonalEconomicCalendar(new AbortController().signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
