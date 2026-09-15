import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLocalWorkspaceAccess } from "./personal-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("local workspace access probe", () => {
  it("accepts only the cookie-free local-mode probe without reading a body", async () => {
    const response = new Response(null, { status: 204 });
    const text = vi.spyOn(response, "text");
    const json = vi.spyOn(response, "json");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await expect(fetchLocalWorkspaceAccess(signal)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL("http://127.0.0.1:3100/v1/personal-filing/session/local-access"),
      {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal,
      },
    );
    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it.each([200, 201, 401, 403, 404, 500])(
    "rejects status %s without reading private error text",
    async (status) => {
      const response = new Response("PRIVATE_RESPONSE_CANARY", { status });
      const text = vi.spyOn(response, "text");
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(
        fetchLocalWorkspaceAccess(new AbortController().signal),
      ).resolves.toBe(false);
      expect(text).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://example.test:3100",
    "http://localhost:3100",
    "http://127.0.0.1:3100/",
    "http://127.0.0.1:3100?canary=true",
  ])("refuses nonadmitted API origin %s", async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", origin);
    const api = await import("./personal-api");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api.fetchLocalWorkspaceAccess(new AbortController().signal),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a controlling service worker", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchLocalWorkspaceAccess(new AbortController().signal),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only unavailable on transport failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("PRIVATE_TRANSPORT_CANARY")),
    );
    await expect(
      fetchLocalWorkspaceAccess(new AbortController().signal),
    ).resolves.toBe(false);
  });

  it("does not fetch when already cancelled, or accept a late successful response", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchLocalWorkspaceAccess(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const late = new AbortController();
    fetchMock.mockImplementation(() => {
      late.abort();
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    await expect(fetchLocalWorkspaceAccess(late.signal)).resolves.toBe(false);
  });
});
