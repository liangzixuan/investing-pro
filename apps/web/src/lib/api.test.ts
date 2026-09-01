import {
  buildDossier,
  DEFAULT_KNOWN_AT,
} from "@research-cockpit/research-core";
import type {
  PersonalFilingReadinessDto,
  PersonalFilingSelectedFactsDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapOwnerSession,
  fetchDossier,
  fetchOwnerSession,
  fetchPersonalFilingReadiness,
  fetchPersonalFilingSelectedFacts,
  logoutOwnerSession,
  revokeOwnerSession,
  rotateOwnerSession,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
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

describe("personal filing readiness API client", () => {
  const readyResponse = {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local",
    status: "quality_gate_ready",
    dataPlane: "disabled",
  } satisfies PersonalFilingReadinessDto;

  it("accepts only the coarse ready state without query, cache, or storage", async () => {
    const localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } satisfies Storage;
    const sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } satisfies Storage;
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(readyResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(fetchPersonalFilingReadiness(controller.signal)).resolves.toBe(
      true,
    );

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL))
      throw new TypeError("Expected the API client to build a URL object");
    expect(url.pathname).toBe("/v1/personal-filing/readiness");
    expect(url.search).toBe("");
    expect(options).toMatchObject({
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("treats a 404 as unavailable without reading its body", async () => {
    const response = new Response("PRIVATE_404_CANARY", { status: 404 });
    const jsonSpy = vi.spyOn(response, "json");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

    await expect(
      fetchPersonalFilingReadiness(new AbortController().signal),
    ).resolves.toBe(false);
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["an extra key", { ...readyResponse, privateValue: "PRIVATE_CANARY" }],
    ["a hostile value", { ...readyResponse, status: "PRIVATE_CANARY" }],
    ["a non-object", "PRIVATE_CANARY"],
  ])("rejects %s without surfacing private content", async (_label, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await fetchPersonalFilingReadiness(
      new AbortController().signal,
    );

    expect(result).toBe(false);
    expect(String(result)).not.toContain("PRIVATE_CANARY");
  });

  it("suppresses malformed and server-error payload details", async () => {
    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("PRIVATE_MALFORMED_CANARY", { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response("PRIVATE_ERROR_CANARY", { status: 500 }),
      );
    vi.stubGlobal("fetch", malformedFetch);
    const signal = new AbortController().signal;

    await expect(fetchPersonalFilingReadiness(signal)).resolves.toBe(false);
    await expect(fetchPersonalFilingReadiness(signal)).resolves.toBe(false);
  });
});

describe("personal filing selected-facts API client", () => {
  const selectedFactsResponse = {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local",
    status: "selected_facts_released",
    facts: [
      {
        key: "assets",
        value: "123456789.25",
        unit: "USD",
        periodStart: null,
        periodEnd: "2025-09-27",
      },
      {
        key: "revenue",
        value: "98765432.1",
        unit: "USD",
        periodStart: "2024-09-29",
        periodEnd: "2025-09-27",
      },
    ],
  } satisfies PersonalFilingSelectedFactsDto;

  it("accepts a closed fact projection without query, cache, or browser storage", async () => {
    const localStorage = storageSpy();
    const sessionStorage = storageSpy();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(selectedFactsResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await fetchPersonalFilingSelectedFacts(controller.signal);

    expect(result).toEqual(selectedFactsResponse);
    expect(result).not.toBe(selectedFactsResponse);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.facts)).toBe(true);
    expect(result?.facts.every(Object.isFrozen)).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
    expect(url.pathname).toBe("/v1/personal-filing/selected-facts");
    expect(url.search).toBe("");
    expect(options).toMatchObject({
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("returns unavailable without reading an error body", async () => {
    const response = new Response("PRIVATE_FACT_ERROR_CANARY", { status: 404 });
    const jsonSpy = vi.spyOn(response, "json");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

    await expect(
      fetchPersonalFilingSelectedFacts(new AbortController().signal),
    ).resolves.toBeNull();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["outer extra key", { ...selectedFactsResponse, privateHash: "PRIVATE" }],
    [
      "fact extra key",
      {
        ...selectedFactsResponse,
        facts: [
          { ...selectedFactsResponse.facts[0], sourceConcept: "PRIVATE" },
        ],
      },
    ],
    [
      "duplicate or out-of-order key",
      {
        ...selectedFactsResponse,
        facts: [selectedFactsResponse.facts[1], selectedFactsResponse.facts[0]],
      },
    ],
    [
      "wrong fixed unit",
      {
        ...selectedFactsResponse,
        facts: [{ ...selectedFactsResponse.facts[0], unit: "shares" }],
      },
    ],
    [
      "noncanonical decimal",
      {
        ...selectedFactsResponse,
        facts: [{ ...selectedFactsResponse.facts[0], value: "01.0" }],
      },
    ],
    [
      "invalid calendar date",
      {
        ...selectedFactsResponse,
        facts: [{ ...selectedFactsResponse.facts[0], periodEnd: "2025-02-30" }],
      },
    ],
  ])("rejects %s atomically", async (_label, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      fetchPersonalFilingSelectedFacts(new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("suppresses malformed success payload content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("PRIVATE_FACT_CANARY", { status: 200 }),
        ),
    );

    await expect(
      fetchPersonalFilingSelectedFacts(new AbortController().signal),
    ).resolves.toBeNull();
  });
});

describe("owner-session API client", () => {
  it("uses only the exact credentialed body-free session requests", async () => {
    const localStorage = storageSpy();
    const sessionStorage = storageSpy();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const bootstrapSecret = "a".repeat(64);

    await expect(fetchOwnerSession(controller.signal)).resolves.toBe(true);
    await expect(
      bootstrapOwnerSession(bootstrapSecret, controller.signal),
    ).resolves.toBe(true);
    await expect(logoutOwnerSession(controller.signal)).resolves.toBe(true);
    await expect(rotateOwnerSession(controller.signal)).resolves.toBe(true);
    await expect(revokeOwnerSession(controller.signal)).resolves.toBe(true);

    const expected = [
      ["/v1/personal-filing/session", "GET", undefined],
      [
        "/v1/personal-filing/session/bootstrap",
        "POST",
        {
          "X-Research-Cockpit-Bootstrap": bootstrapSecret,
          "X-Research-Cockpit-Intent": "bootstrap",
        },
      ],
      [
        "/v1/personal-filing/session/logout",
        "POST",
        { "X-Research-Cockpit-Intent": "logout" },
      ],
      [
        "/v1/personal-filing/session/rotate",
        "POST",
        { "X-Research-Cockpit-Intent": "rotate" },
      ],
      [
        "/v1/personal-filing/session/revoke",
        "POST",
        { "X-Research-Cockpit-Intent": "revoke" },
      ],
    ] as const;
    expect(fetchMock).toHaveBeenCalledTimes(expected.length);
    for (const [index, [path, method, headers]] of expected.entries()) {
      const [url, options] = fetchMock.mock.calls[index] ?? [];
      expect(url).toBeInstanceOf(URL);
      if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
      expect(url.pathname).toBe(path);
      expect(url.search).toBe("");
      expect(url.href).not.toContain(bootstrapSecret);
      expect(options).toMatchObject({
        cache: "no-store",
        credentials: "include",
        method,
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      expect(options).not.toHaveProperty("body");
      if (headers === undefined) expect(options?.headers).toBeUndefined();
      else expect(options?.headers).toEqual(headers);
    }
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });

  it("treats non-204 responses as unavailable without reading a body", async () => {
    const response = new Response("SESSION_PRIVATE_CANARY", { status: 403 });
    const jsonSpy = vi.spyOn(response, "json");
    const textSpy = vi.spyOn(response, "text");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

    await expect(fetchOwnerSession(new AbortController().signal)).resolves.toBe(
      false,
    );
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("does not send an empty bootstrap credential", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      bootstrapOwnerSession("", new AbortController().signal),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send a malformed bootstrap credential", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      bootstrapOwnerSession(
        "bootstrap_private_canary",
        new AbortController().signal,
      ),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("personal API base URL boundary", () => {
  const invalidPersonalApiBaseUrls = [
    ["empty configuration", ""],
    ["localhost alias", "http://localhost:3100"],
    ["another IPv4 loopback address", "http://127.0.0.2:3100"],
    ["an integer-form IPv4 address", "http://2130706433:3100"],
    ["an expanded IPv6 loopback address", "http://[0:0:0:0:0:0:0:1]:3100"],
    ["an uppercase scheme", "HTTP://127.0.0.1:3100"],
    ["an IPv4 HTTPS origin", "https://127.0.0.1:3100"],
    ["an IPv6 HTTPS origin", "https://[::1]:3100"],
    ["a remote origin", "http://192.0.2.1:3100"],
    ["IPv4 userinfo", "http://owner@127.0.0.1:3100"],
    ["IPv6 userinfo", "http://owner:secret@[::1]:3100"],
    ["an implicit IPv4 port", "http://127.0.0.1"],
    ["an implicit IPv6 port", "http://[::1]"],
    ["port zero", "http://127.0.0.1:0"],
    ["a leading-zero port", "http://127.0.0.1:03100"],
    ["an out-of-range port", "http://127.0.0.1:65536"],
    ["a negative port", "http://127.0.0.1:-1"],
    ["a nonnumeric port", "http://127.0.0.1:port"],
    ["a trailing slash", "http://127.0.0.1:3100/"],
    ["a path", "http://127.0.0.1:3100/v1"],
    ["a query", "http://127.0.0.1:3100?target=private"],
    ["a fragment", "http://127.0.0.1:3100#private"],
    ["a trailing newline", "http://127.0.0.1:3100\n"],
    ["leading whitespace", " http://127.0.0.1:3100"],
    ["a trailing-dot host", "http://127.0.0.1.:3100"],
    ["a scheme-relative URL", "//127.0.0.1:3100"],
    ["a malformed URL", "not a URL"],
  ] as const;

  it.each(invalidPersonalApiBaseUrls)(
    "fails every personal request closed before fetch for %s",
    async (_label, configuredBaseUrl) => {
      const api = await importApiWithBaseUrl(configuredBaseUrl);
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);
      const signal = new AbortController().signal;
      const bootstrapSecret = "b".repeat(64);

      await expect(api.fetchOwnerSession(signal)).resolves.toBe(false);
      await expect(
        api.bootstrapOwnerSession(bootstrapSecret, signal),
      ).resolves.toBe(false);
      await expect(api.logoutOwnerSession(signal)).resolves.toBe(false);
      await expect(api.rotateOwnerSession(signal)).resolves.toBe(false);
      await expect(api.revokeOwnerSession(signal)).resolves.toBe(false);
      await expect(api.fetchPersonalFilingReadiness(signal)).resolves.toBe(
        false,
      );
      await expect(api.fetchPersonalFilingSelectedFacts(signal)).resolves.toBe(
        null,
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
        bootstrapSecret,
      );
    },
  );

  it.each([
    "http://127.0.0.1:1",
    "http://127.0.0.1:65535",
    "http://[::1]:3100",
  ])("accepts the exact literal loopback HTTP origin %s", async (baseUrl) => {
    const api = await importApiWithBaseUrl(baseUrl);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.fetchOwnerSession(new AbortController().signal),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
    expect(url.href).toBe(`${baseUrl}/v1/personal-filing/session`);
  });

  it.each([
    ["http://127.0.0.1:80", "http://127.0.0.1/v1/personal-filing/session"],
    ["http://[::1]:80", "http://[::1]/v1/personal-filing/session"],
  ])(
    "accepts explicit HTTP port 80 and uses its canonical URL for %s",
    async (baseUrl, expectedUrl) => {
      const api = await importApiWithBaseUrl(baseUrl);
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        api.fetchOwnerSession(new AbortController().signal),
      ).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBeInstanceOf(URL);
      if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
      expect(url.href).toBe(expectedUrl);
    },
  );

  it("fails every personal request closed under a controlling service worker", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { controller: Object.freeze({}) },
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const bootstrapSecret = "c".repeat(64);

    await expect(fetchOwnerSession(signal)).resolves.toBe(false);
    await expect(bootstrapOwnerSession(bootstrapSecret, signal)).resolves.toBe(
      false,
    );
    await expect(fetchPersonalFilingReadiness(signal)).resolves.toBe(false);
    await expect(fetchPersonalFilingSelectedFacts(signal)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when service-worker control cannot be inspected", async () => {
    const navigatorWithFailingServiceWorker = {};
    Object.defineProperty(navigatorWithFailingServiceWorker, "serviceWorker", {
      get() {
        throw new Error("Service-worker state unavailable.");
      },
    });
    vi.stubGlobal("navigator", navigatorWithFailingServiceWorker);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchOwnerSession(new AbortController().signal)).resolves.toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not apply the personal-only guard to synthetic dossiers", async () => {
    const remoteBaseUrl = "https://api.example.test:444";
    const api = await importApiWithBaseUrl(remoteBaseUrl);
    const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
    expect(dossier).not.toBeNull();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(dossier), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.fetchDossier("SYN1", DEFAULT_KNOWN_AT, new AbortController().signal),
    ).resolves.toMatchObject({ instrument: { symbol: "SYN1" } });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
    expect(url.origin).toBe(remoteBaseUrl);
  });
});

async function importApiWithBaseUrl(baseUrl: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
  return import("./api");
}

function storageSpy() {
  return {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  } satisfies Storage;
}
