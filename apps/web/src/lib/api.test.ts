import {
  buildDossier,
  DEFAULT_KNOWN_AT,
} from "@research-cockpit/research-core";
import type {
  PersonalFilingDossierDto,
  PersonalFilingReadinessDto,
  PersonalFilingSelectedFactsDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapOwnerSession,
  fetchDossier,
  fetchOwnerSession,
  fetchPersonalFilingDossier,
  fetchPersonalFilingReadiness,
  fetchPersonalFilingSelectedFacts,
  logoutOwnerSession,
  revokeOwnerSession,
  rotateOwnerSession,
  parsePersonalFilingDossier,
} from "./api";
import { buildPersonalDossierFixture } from "../features/research/test-personal-dossier-builder";

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

describe("personal filing dossier API client", () => {
  it("accepts and deeply freezes one closed credentialed dossier graph", async () => {
    const localStorage = storageSpy();
    const sessionStorage = storageSpy();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);
    const fixture = buildCanonicalPersonalDossierFixture();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await fetchPersonalFilingDossier(controller.signal);

    expect(result).toEqual(fixture);
    expect(result).not.toBe(fixture);
    expectDeeplyFrozen(result);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new TypeError("Expected a URL object");
    expect(url.pathname).toBe("/v1/personal-filing/dossier");
    expect(url.search).toBe("");
    expect(options).toMatchObject({
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    expect(options).not.toHaveProperty("body");
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      "an outer extra field",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        privatePath: "PRIVATE",
      }),
    ],
    [
      "a synthetic mode marker",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        dataMode: "synthetic",
      }),
    ],
    [
      "a duplicated fact id",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        facts: [value.facts[0], { ...value.facts[1], id: value.facts[0]?.id }],
      }),
    ],
    [
      "a noncanonical fact ordinal",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        facts: [value.facts[1], value.facts[0], ...value.facts.slice(2)],
      }),
    ],
    [
      "a noncanonical evidence ordinal",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        evidence: [
          value.evidence[1],
          value.evidence[0],
          ...value.evidence.slice(2),
        ],
      }),
    ],
    [
      "an as-of instant that differs from the current snapshot",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        asOf: "2025-04-01T12:00:00.000Z",
      }),
    ],
    [
      "an unresolved evidence reference",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        facts: value.facts.map((fact, index) =>
          index === 0 ? { ...fact, evidenceId: "evidence-9999" } : fact,
        ),
      }),
    ],
    [
      "a broken lineage edge",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        lineage: {
          ...value.lineage,
          events: value.lineage.events.map((event) => ({
            ...event,
            successorFactId: "fact-0001",
          })),
        },
      }),
    ],
    [
      "a chart point with a copied value",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        chart:
          value.chart.status === "ready"
            ? {
                ...value.chart,
                series: value.chart.series.map((series) => ({
                  ...series,
                  points: series.points.map((point) => ({
                    ...point,
                    value: "PRIVATE_DUPLICATE",
                  })),
                })),
              }
            : value.chart,
      }),
    ],
    [
      "a valuation reference to the wrong fact key",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        valuationInputs:
          value.valuationInputs.status === "ready"
            ? {
                ...value.valuationInputs,
                cashFactId: value.valuationInputs.baseRevenueFactId,
              }
            : value.valuationInputs,
      }),
    ],
    [
      "a noncanonical decimal",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        facts: value.facts.map((fact, index) =>
          index === 0 ? { ...fact, value: "01.0" } : fact,
        ),
      }),
    ],
    [
      "mixed source-document metadata",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        evidence: value.evidence.map((item, index) =>
          index === 4
            ? { ...item, sourceDocumentSha256: `sha256:${"e".repeat(64)}` }
            : item,
        ),
      }),
    ],
    [
      "an overlong source concept",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        evidence: value.evidence.map((item, index) =>
          index === 0
            ? { ...item, sourceConcept: `us-gaap:${"x".repeat(129)}` }
            : item,
        ),
      }),
    ],
    [
      "noncanonical lineage-event order",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        lineage: {
          ...value.lineage,
          events: [...value.lineage.events].reverse(),
        },
      }),
    ],
    [
      "an incomplete ready chart series",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        chart:
          value.chart.status === "ready"
            ? {
                ...value.chart,
                series: value.chart.series.map((series) => ({
                  ...series,
                  points: series.points.slice(1),
                })),
              }
            : value.chart,
      }),
    ],
    [
      "incompatible instant and duration chart series",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        chart:
          value.chart.status === "ready"
            ? {
                status: "ready",
                series: [
                  {
                    key: "cash",
                    label: "Cash",
                    unit: "USD",
                    points: [{ factId: "fact-0001" }, { factId: "fact-0005" }],
                  },
                  ...value.chart.series,
                ],
              }
            : value.chart,
      }),
    ],
    [
      "a ready valuation with an out-of-domain input",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        facts: value.facts.map((fact) =>
          fact.id === "fact-0008" ? { ...fact, value: "-1" } : fact,
        ),
      }),
    ],
    [
      "an unsupported valuation despite complete valid inputs",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        valuationInputs: {
          status: "unsupported",
          reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
        },
      }),
    ],
    [
      "an injected omission explanation",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        omissions: {
          ...value.omissions,
          explanation: "PRIVATE_PATH_CANARY",
        },
      }),
    ],
    [
      "an omission flag inconsistent with the admitted keys",
      (value: PersonalFilingDossierDto) => ({
        ...value,
        omissions: { ...value.omissions, hasOmissions: false },
      }),
    ],
  ])("rejects %s atomically", (_label, mutate) => {
    const hostile = mutate(buildCanonicalPersonalDossierFixture());
    expect(parsePersonalFilingDossier(hostile)).toBeNull();
  });

  it("requires canonical fact-key order inside a root snapshot", () => {
    const fixture = buildCanonicalPersonalDossierFixture();

    expect(
      parsePersonalFilingDossier(buildRootDossier(fixture, [4, 5])),
    ).not.toBeNull();
    expect(
      parsePersonalFilingDossier(buildRootDossier(fixture, [5, 4])),
    ).toBeNull();
  });

  it("rejects malformed derivation operands and accepts the exact FCF pair", () => {
    const fixture = buildCanonicalPersonalDossierFixture();
    const fcfFact = {
      ...fixture.facts[0],
      id: "fact-0001",
      evidenceId: "evidence-0001",
      key: "free_cash_flow",
      label: "Free cash flow",
      periodStart: "2024-01-01",
      value: "75",
      knownFrom: fixture.asOf,
      knownToExclusive: null,
      version: "current",
    } as const;
    const fcfEvidence = {
      ...fixture.evidence[0],
      id: fcfFact.evidenceId,
      factId: fcfFact.id,
      sourceAcceptedAt: fixture.asOf,
      sourceAvailableAt: fixture.asOf,
      sourceConcept: null,
      derivationFormula: "operating_cash_flow_minus_capital_expenditures",
      derivationOperands: [
        {
          role: "minuend",
          concept: "us-gaap:NetCashProvidedByUsedInOperatingActivities",
          value: "100",
          unit: "USD",
          periodStart: fcfFact.periodStart,
          periodEnd: fcfFact.periodEnd,
        },
        {
          role: "subtrahend",
          concept: "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
          value: "25",
          unit: "USD",
          periodStart: fcfFact.periodStart,
          periodEnd: fcfFact.periodEnd,
        },
      ],
    } as const;
    const exact = {
      ...fixture,
      facts: [fcfFact],
      evidence: [fcfEvidence],
      lineage: {
        ...fixture.lineage,
        events: [],
        status: "root_only_no_in_corpus_amendment",
      },
      chart: {
        status: "unsupported",
        reasonCode: "NO_OWNER_APPROVED_CHART_FACTS",
      },
      valuationInputs: {
        status: "unsupported",
        reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
      },
    };

    expect(parsePersonalFilingDossier(exact)).not.toBeNull();
    expect(
      parsePersonalFilingDossier({
        ...exact,
        evidence: exact.evidence.map((item) =>
          item.id === fcfEvidence.id
            ? {
                ...item,
                derivationOperands: [
                  item.derivationOperands[1],
                  item.derivationOperands[0],
                ],
              }
            : item,
        ),
      }),
    ).toBeNull();
    expect(
      parsePersonalFilingDossier({
        ...exact,
        evidence: exact.evidence.map((item) => ({
          ...item,
          derivationOperands: item.derivationOperands.map((operand) =>
            operand.role === "subtrahend"
              ? { ...operand, value: "24" }
              : operand,
          ),
        })),
      }),
    ).toBeNull();
  });

  it("does not read or surface denial, unavailability, or malformed bodies", async () => {
    const denied = new Response("PRIVATE_DENIAL_CANARY", { status: 403 });
    const unavailable = new Response("PRIVATE_UNAVAILABLE_CANARY", {
      status: 404,
    });
    const malformed = new Response("PRIVATE_MALFORMED_CANARY", { status: 200 });
    const deniedJson = vi.spyOn(denied, "json");
    const unavailableJson = vi.spyOn(unavailable, "json");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(denied)
        .mockResolvedValueOnce(unavailable)
        .mockResolvedValueOnce(malformed),
    );
    const signal = new AbortController().signal;

    await expect(fetchPersonalFilingDossier(signal)).resolves.toBeNull();
    await expect(fetchPersonalFilingDossier(signal)).resolves.toBeNull();
    await expect(fetchPersonalFilingDossier(signal)).resolves.toBeNull();
    expect(deniedJson).not.toHaveBeenCalled();
    expect(unavailableJson).not.toHaveBeenCalled();
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
      await expect(api.fetchPersonalFilingDossier(signal)).resolves.toBeNull();

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
    await expect(fetchPersonalFilingDossier(signal)).resolves.toBeNull();
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

function buildCanonicalPersonalDossierFixture(): PersonalFilingDossierDto {
  const fixture = buildPersonalDossierFixture();
  return {
    ...fixture,
    evidence: fixture.evidence.map((item, index) =>
      index < 4
        ? item
        : {
            ...item,
            sourceContentSha256: `sha256:${"c".repeat(64)}`,
            sourceDocumentSha256: `sha256:${"d".repeat(64)}`,
          },
    ),
    omissions: {
      ...fixture.omissions,
      explanation:
        "The dossier contains only the exact owner-fixed fact scope.",
    },
  };
}

function buildRootDossier(
  fixture: PersonalFilingDossierDto,
  sourceIndexes: readonly number[],
): PersonalFilingDossierDto {
  const facts = sourceIndexes.map((sourceIndex, index) => {
    const fact = fixture.facts[sourceIndex];
    if (fact === undefined) throw new TypeError("Missing fixture fact.");
    const ordinal = String(index + 1).padStart(4, "0");
    return {
      ...fact,
      evidenceId: `evidence-${ordinal}`,
      id: `fact-${ordinal}`,
    };
  });
  const evidence = sourceIndexes.map((sourceIndex, index) => {
    const item = fixture.evidence[sourceIndex];
    if (item === undefined) throw new TypeError("Missing fixture evidence.");
    const ordinal = String(index + 1).padStart(4, "0");
    return {
      ...item,
      factId: `fact-${ordinal}`,
      id: `evidence-${ordinal}`,
    };
  });
  return {
    ...fixture,
    chart: {
      reasonCode: "NO_OWNER_APPROVED_CHART_FACTS",
      status: "unsupported",
    },
    evidence,
    facts,
    lineage: {
      events: [],
      scope: "issuer_filing_versions_within_exact_frozen_manifest_only",
      status: "root_only_no_in_corpus_amendment",
    },
    valuationInputs: {
      reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
      status: "unsupported",
    },
  } as PersonalFilingDossierDto;
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

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}
