import { afterEach, describe, expect, it, vi } from "vitest";

import { loginOwnerSession } from "./personal-api";

const username = "synthetic-owner";
const password = "Synthetic password only!";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("owner account login client", () => {
  it("sends credentials only in a private JSON POST with the login intent", async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    await expect(
      loginOwnerSession(username, password, signal),
    ).resolves.toEqual({ status: "active" });

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL("http://127.0.0.1:3100/v1/personal-filing/session/login"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Research-Cockpit-Intent": "login",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal,
      },
    );
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    [401, "invalid_credentials"],
    [403, "unavailable"],
    [200, "unavailable"],
    [500, "unavailable"],
  ])(
    "handles status %s without inspecting or exposing response bodies",
    async (status, expectedStatus) => {
      const response = new Response("PRIVATE_RESPONSE_CANARY", { status });
      const json = vi.spyOn(response, "json");
      const text = vi.spyOn(response, "text");
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(
        loginOwnerSession(username, password, new AbortController().signal),
      ).resolves.toEqual({ status: expectedStatus });
      expect(json).not.toHaveBeenCalled();
      expect(text).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["1", 1],
    ["60", 60],
    ["3600", 3600],
    ["3601", null],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["PRIVATE_HEADER_CANARY", null],
    [null, null],
  ])(
    "accepts only bounded integer Retry-After seconds: %s",
    async (retryAfter, retryAfterSeconds) => {
      const headers = retryAfter === null ? {} : { "Retry-After": retryAfter };
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 429, headers })),
      );
      await expect(
        loginOwnerSession(username, password, new AbortController().signal),
      ).resolves.toEqual({ status: "rate_limited", retryAfterSeconds });
    },
  );

  it.each([
    ["", password],
    [username, ""],
  ])(
    "does not send empty credentials",
    async (inputUsername, inputPassword) => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        loginOwnerSession(
          inputUsername,
          inputPassword,
          new AbortController().signal,
        ),
      ).resolves.toEqual({ status: "invalid_credentials" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://example.test:3100",
    "http://localhost:3100",
    "http://127.0.0.1:3100/",
    "http://127.0.0.1:3100?private=true",
  ])(
    "does not send credentials to an invalid personal API origin: %s",
    async (apiBase) => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", apiBase);
      const api = await import("./personal-api");
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        api.loginOwnerSession(username, password, new AbortController().signal),
      ).resolves.toEqual({ status: "unavailable" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a controlling service worker before exposing credentials to fetch", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      loginOwnerSession(username, password, new AbortController().signal),
    ).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns transport errors into generic unavailable feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("PRIVATE_TRANSPORT_CANARY")),
    );
    await expect(
      loginOwnerSession(username, password, new AbortController().signal),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("propagates cancellation without an arbitrary transport message", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(() => {
        controller.abort();
        return Promise.reject(new Error("PRIVATE_TRANSPORT_CANARY"));
      }),
    );
    await expect(
      loginOwnerSession(username, password, controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
      message: "The operation was aborted.",
    });
  });
});
