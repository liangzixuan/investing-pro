import {
  buildDossier,
  DEFAULT_KNOWN_AT,
} from "@research-cockpit/research-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDossier } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dossier API client", () => {
  it("requests an encoded as-known view without browser caching", async () => {
    const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
    expect(dossier).not.toBeNull();
    const response = new Response(JSON.stringify(dossier), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await fetchDossier(
      "SYN1",
      DEFAULT_KNOWN_AT,
      controller.signal,
    );

    expect(result.instrument.symbol).toBe("SYN1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL))
      throw new TypeError("Expected the API client to build a URL object");
    expect(url.pathname).toBe("/v1/instruments/SYN1/dossier");
    expect(url.searchParams.get("knownAt")).toBe(DEFAULT_KNOWN_AT);
    expect(options).toMatchObject({
      cache: "no-store",
      signal: controller.signal,
    });
  });

  it("surfaces the API problem detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "https://research-cockpit.local/problems/400",
            title: "Invalid knownAt",
            status: 400,
            detail: "knownAt must be an RFC 3339 date-time",
            instance: "/v1/instruments/SYN1/dossier",
            traceId: "trace-test",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );

    await expect(
      fetchDossier("SYN1", "not-a-date", new AbortController().signal),
    ).rejects.toThrow("knownAt must be an RFC 3339 date-time");
  });
});
