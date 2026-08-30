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
  fetchDossier,
  fetchPersonalFilingReadiness,
  fetchPersonalFilingSelectedFacts,
} from "./api";

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
      credentials: "omit",
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
      credentials: "omit",
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
