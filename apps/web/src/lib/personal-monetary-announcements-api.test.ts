import {
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPersonalMonetaryAnnouncements } from "./personal-workspace-api";

const fetchMock = vi.fn<typeof fetch>();
function fixture(): PersonalMonetaryAnnouncementsDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_FED_MONETARY_SOURCE,
    fetchedAt: "2026-09-27T04:00:00.000Z",
    availableItemCount: 1,
    items: [
      {
        title: "Synthetic policy announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
        publishedAt: "2026-09-16T18:00:00.000Z",
      },
    ],
  };
}
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("monetary announcements client", () => {
  it("requests the authenticated fixed local route and deep-freezes admitted data", async () => {
    const input = fixture();
    fetchMock.mockResolvedValue(Response.json(input));
    const signal = new AbortController().signal;
    const result = await fetchPersonalMonetaryAnnouncements(signal);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/monetary-policy-announcements",
      ),
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
    for (const value of [result, result.source, result.items, result.items[0]])
      expect(Object.isFrozen(value)).toBe(true);
  });
  it("accepts an explicitly empty source", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ...fixture(), availableItemCount: 0, items: [] }),
    );
    expect(
      (await fetchPersonalMonetaryAnnouncements(new AbortController().signal))
        .items,
    ).toEqual([]);
  });
  it.each([
    { ...fixture(), extra: true },
    {
      ...fixture(),
      source: {
        ...PERSONAL_FED_MONETARY_SOURCE,
        feedUrl: "https://example.com",
      },
    },
    { ...fixture(), availableItemCount: 2 },
    {
      ...fixture(),
      items: [{ ...fixture().items[0], url: "https://example.com/item" }],
    },
    {
      ...fixture(),
      items: [
        { ...fixture().items[0], publishedAt: "2026-02-30T18:00:00.000Z" },
      ],
    },
    {
      ...fixture(),
      availableItemCount: 2,
      items: [fixture().items[0], fixture().items[0]],
    },
  ])("rejects data outside the shared contract", async (value) => {
    fetchMock.mockResolvedValue(Response.json(value));
    await expect(
      fetchPersonalMonetaryAnnouncements(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [403, "session_unavailable"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "provider_unavailable"],
    [500, "unavailable"],
  ])("maps HTTP %s without reading its error payload", async (status, code) => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json,
    } as unknown as Response);
    await expect(
      fetchPersonalMonetaryAnnouncements(new AbortController().signal),
    ).rejects.toMatchObject({ code });
    expect(json).not.toHaveBeenCalled();
  });
  it("does not start a cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchPersonalMonetaryAnnouncements(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cancellation while decoding a successful response", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => {
        controller.abort();
        return Promise.resolve(fixture());
      },
    } as Response);
    await expect(
      fetchPersonalMonetaryAnnouncements(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("hides malformed JSON and transport details without retries", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json"));
    await expect(
      fetchPersonalMonetaryAnnouncements(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockRejectedValueOnce(new Error("private transport details"));
    await expect(
      fetchPersonalMonetaryAnnouncements(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "unavailable",
      message: "The personal workspace request was not accepted.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("refuses a controlling service worker before IO", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    await expect(
      fetchPersonalMonetaryAnnouncements(new AbortController().signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
