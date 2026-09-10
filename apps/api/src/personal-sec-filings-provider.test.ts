import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSecPersonalFilingsProvider as createProvider } from "./personal-sec-filings-provider";
import { createPersonalSecRequestScheduler } from "./personal-sec-request-scheduler";

function createSecPersonalFilingsProvider(
  ...[userAgent, dependencies]: Parameters<typeof createProvider>
) {
  return createProvider(userAgent, {
    scheduler: createPersonalSecRequestScheduler({ now: () => Date.now() }),
    ...dependencies,
  });
}

const NOW = new Date("2026-09-09T18:00:00.000Z");
const USER_AGENT = "PersonalResearch/1.0 owner@example.test";
const FROM = "2026-08-11";
const THROUGH = "2026-09-09";
const CIK = "0000000042";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accessionNumber: "0000000042-26-000001",
    form: "8-K",
    filingDate: "2026-09-08",
    reportDate: "2026-09-07",
    ...overrides,
  };
}

function payload(
  cik: unknown = CIK,
  rows: readonly Record<string, unknown>[] = [row()],
  files: unknown = [],
) {
  return {
    cik,
    name: "Synthetic issuer, not source evidence",
    filings: {
      recent: {
        accessionNumber: rows.map((value) => value.accessionNumber),
        form: rows.map((value) => value.form),
        filingDate: rows.map((value) => value.filingDate),
        reportDate: rows.map((value) => value.reportDate),
      },
      files,
    },
  };
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function mockedFetch(transform?: (cik: string, index: number) => Response) {
  let index = 0;
  return vi.fn<typeof fetch>((input) => {
    const cik = requestUrl(input).match(/CIK(\d{10})\.json$/u)?.[1] ?? "";
    return Promise.resolve(
      transform?.(cik, index++) ?? Response.json(payload(cik)),
    );
  });
}

async function finish<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("SEC recent filing provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires the declared SEC contact and does no constructor or status network work", async () => {
    const fetch = mockedFetch();
    for (const userAgent of [
      undefined,
      "",
      "Mozilla/5.0",
      " App owner@example.test",
      "App owner@example.test\r\nSecret: canary",
      `App ${"x".repeat(260)}@example.test`,
    ]) {
      const provider = createSecPersonalFilingsProvider(userAgent, { fetch });
      expect(provider.status()).toEqual({ configured: false });
      await expect(
        provider.loadFilings([CIK], FROM, THROUGH),
      ).rejects.toMatchObject({
        code: "not_configured",
        message: "Personal watchlist filing data is unavailable.",
      });
    }
    expect(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).status(),
    ).toEqual({ configured: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses only fixed SEC requests, spaces across batches, and never follows source-controlled documents", async () => {
    const starts: number[] = [];
    const fetch = mockedFetch((cik) => {
      starts.push(Date.now());
      return Response.json({
        ...payload(
          cik,
          [row()],
          [
            {
              name: "https://private.example.test/source-canary",
              filingFrom: "1900-01-01",
            },
          ],
        ),
        primaryDocument: "https://private.example.test/another-canary",
        url: "http://127.0.0.1/secret",
      });
    });
    const provider = createSecPersonalFilingsProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
    });
    const first = await finish(
      provider.loadFilings([CIK, "0000000007"], FROM, THROUGH),
    );
    await finish(provider.loadFilings([CIK], FROM, THROUGH));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(300);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(300);
    for (const [index, [url, init]] of fetch.mock.calls.entries()) {
      expect(url).toBe(
        `https://data.sec.gov/submissions/CIK${index === 1 ? "0000000007" : CIK}.json`,
      );
      expect(init).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
        accept: "application/json",
        "user-agent": USER_AGENT,
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(first[0]).toMatchObject({
      cik: CIK,
      status: "available",
      fetchedAt: NOW.toISOString(),
      olderHistoryAvailable: true,
      matchingFilings: 1,
      truncated: false,
      sourceUrl: `https://data.sec.gov/submissions/CIK${CIK}.json`,
      filings: [
        {
          sourceUrl:
            "https://www.sec.gov/Archives/edgar/data/42/0000000042-26-000001-index.htm",
        },
      ],
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0]?.filings[0])).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(
      /canary|127\.0\.0\.1|owner@example/u,
    );
  });

  it("normalizes issuer CIKs, real dates and empty report dates while retaining amendments", async () => {
    const rows = [
      row({
        accessionNumber: "0000000042-26-000004",
        form: "10-Q/A",
        filingDate: THROUGH,
        reportDate: null,
      }),
      row({
        accessionNumber: "0000000042-26-000002",
        form: "10-Q",
        filingDate: THROUGH,
        reportDate: "",
      }),
      row({ accessionNumber: "0000000042-26-000003", filingDate: FROM }),
      row({
        accessionNumber: "0000000042-26-000001",
        filingDate: "2026-08-10",
      }),
      row({
        accessionNumber: "0000000042-26-000005",
        filingDate: "2026-09-10",
      }),
    ];
    const provider = createSecPersonalFilingsProvider(USER_AGENT, {
      fetch: mockedFetch(() => Response.json(payload(42, rows))),
    });
    const result = await finish(provider.loadFilings([CIK], FROM, THROUGH));
    expect(
      result[0]?.filings.map((value) => [
        value.accessionNumber,
        value.form,
        value.reportDate,
      ]),
    ).toEqual([
      ["0000000042-26-000002", "10-Q", null],
      ["0000000042-26-000004", "10-Q/A", null],
      ["0000000042-26-000003", "8-K", "2026-09-07"],
    ]);
    expect(result[0]?.matchingFilings).toBe(3);
    expect(result[0]?.olderHistoryAvailable).toBe(false);
  });

  it("deduplicates identical accessions without depending on input order", async () => {
    const rows = [
      row(),
      row({ accessionNumber: "0000000042-26-000002" }),
      row(),
    ];
    const first = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: mockedFetch(() => Response.json(payload(CIK, rows))),
      }).loadFilings([CIK], FROM, THROUGH),
    );
    const second = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: mockedFetch(() =>
          Response.json(payload(CIK, [...rows].reverse())),
        ),
      }).loadFilings([CIK], FROM, THROUGH),
    );
    expect(first[0]?.filings).toEqual(second[0]?.filings);
    expect(first[0]?.matchingFilings).toBe(2);
  });

  it.each(["42.0000000000000001", "4.2e1", "9007199254740993"])(
    "rejects numeric CIK lexemes that could round or coerce into another identity: %s",
    async (lexeme) => {
      const result = await finish(
        createSecPersonalFilingsProvider(USER_AGENT, {
          fetch: mockedFetch(
            () =>
              new Response(
                JSON.stringify(payload("RAW_CIK")).replace('"RAW_CIK"', lexeme),
              ),
          ),
        }).loadFilings([CIK], FROM, THROUGH),
      );
      expect(result[0]?.status).toBe("invalid_response");
    },
  );

  it.each([
    { form: "10-Q" },
    { filingDate: "2026-09-01" },
    { reportDate: "2026-09-06" },
  ])(
    "rejects conflicting duplicate metadata across the entire response: %j",
    async (conflict) => {
      const result = await finish(
        createSecPersonalFilingsProvider(USER_AGENT, {
          fetch: mockedFetch(() =>
            Response.json(payload(CIK, [row(), row(conflict)])),
          ),
        }).loadFilings([CIK], FROM, THROUGH),
      );
      expect(result[0]).toMatchObject({
        status: "invalid_response",
        filings: [],
        matchingFilings: 0,
      });
    },
  );

  it.each([
    { cik: "0000000043" },
    { cik: 0 },
    { cik: -42 },
    { cik: "0042.0" },
    { cik: true },
    { cik: "https://private.example.test/canary" },
    { filings: [] },
    { filings: { recent: null, files: [] } },
    {
      filings: {
        recent: payload().filings.recent,
        files: "https://private.example.test/canary",
      },
    },
    {
      filings: { recent: { ...payload().filings.recent, form: [] }, files: [] },
    },
    {
      filings: {
        recent: { ...payload().filings.recent, reportDate: "2026-01-01" },
        files: [],
      },
    },
  ])(
    "rejects mismatched issuer identity or columnar schema: %j",
    async (overrides) => {
      const fetch = mockedFetch(() =>
        Response.json({ ...payload(), ...overrides }),
      );
      const result = await finish(
        createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
          [CIK],
          FROM,
          THROUGH,
        ),
      );
      expect(result[0]?.status).toBe("invalid_response");
      expect(result[0]?.filings).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { accessionNumber: "https://private.example.test/canary" },
    { accessionNumber: "0000000042-26-000001/../secret" },
    { form: "" },
    { form: 3 },
    { form: " 8-K" },
    { form: "8-K\n" },
    { form: "<script>" },
    { form: "A".repeat(41) },
    { filingDate: "2026-02-30" },
    { filingDate: "2026-09-08T00:00:00Z" },
    { filingDate: null },
    { reportDate: "2026-13-01" },
    { reportDate: 20260907 },
  ])(
    "rejects malformed row metadata even outside the selected interval: %j",
    async (overrides) => {
      const result = await finish(
        createSecPersonalFilingsProvider(USER_AGENT, {
          fetch: mockedFetch(() =>
            Response.json(
              payload(CIK, [
                row(),
                row({
                  accessionNumber: "0000000042-26-000009",
                  filingDate: "2020-01-01",
                  ...overrides,
                }),
              ]),
            ),
          ),
        }).loadFilings([CIK], FROM, THROUGH),
      );
      expect(result[0]).toMatchObject({
        status: "invalid_response",
        matchingFilings: 0,
        filings: [],
      });
    },
  );

  it("retains source failures per issuer and distinguishes valid empty data from missing coverage", async () => {
    const ciks = Array.from({ length: 7 }, (_, index) =>
      String(index + 1).padStart(10, "0"),
    );
    const fetch = mockedFetch((cik, index) => {
      if (index === 0)
        return new Response("sensitive-source-canary", { status: 429 });
      if (index === 1)
        return new Response("sensitive-source-canary", { status: 404 });
      if (index === 2)
        return new Response("sensitive-source-canary", { status: 403 });
      if (index === 3)
        return new Response("sensitive-source-canary", { status: 500 });
      if (index === 4) return new Response("malformed-json-canary");
      return Response.json(payload(cik, index === 5 ? [] : [row()]));
    });
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
        ciks,
        FROM,
        THROUGH,
      ),
    );
    expect(result.map((value) => value.status)).toEqual([
      "rate_limited",
      "not_covered",
      "upstream_unavailable",
      "upstream_unavailable",
      "invalid_response",
      "available",
      "available",
    ]);
    expect(
      result
        .slice(0, 6)
        .every(
          (value) => value.matchingFilings === 0 && value.filings.length === 0,
        ),
    ).toBe(true);
    expect(result[6]?.matchingFilings).toBe(1);
    expect(JSON.stringify(result)).not.toContain("canary");
  });

  it("caps retained results after filtering and sorting and reports exact unique matching counts", async () => {
    const rows = Array.from({ length: 1_002 }, (_, index) =>
      row({
        accessionNumber: `0000000042-26-${String(index + 1).padStart(6, "0")}`,
      }),
    );
    rows[0] = row({ filingDate: "2020-01-01" });
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: mockedFetch(() =>
          Response.json(payload(CIK, [...rows].reverse())),
        ),
      }).loadFilings([CIK], FROM, THROUGH),
    );
    expect(result[0]).toMatchObject({
      status: "available",
      matchingFilings: 1_001,
      truncated: true,
    });
    expect(result[0]?.filings).toHaveLength(1_000);
    expect(result[0]?.filings[0]?.accessionNumber).toBe("0000000042-26-000002");
    const oversized = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: mockedFetch(() =>
          Response.json(
            payload(
              CIK,
              Array.from({ length: 10_001 }, () => row()),
            ),
          ),
        ),
      }).loadFilings([CIK], FROM, THROUGH),
    );
    expect(oversized[0]?.status).toBe("invalid_response");
  });

  it("caps declared and streamed bytes, rejects invalid encodings and cancels oversized bodies", async () => {
    const canceled = vi.fn();
    const responses = [
      new Response("{}", {
        headers: { "content-length": String(4 * 1024 * 1024 + 1) },
      }),
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
          },
          cancel: canceled,
        }),
      ),
      new Response(new Uint8Array([0xc3, 0x28])),
      new Response("{}", { headers: { "content-length": "NaN" } }),
      new Response("{}", { headers: { "content-length": "9007199254740993" } }),
      new Response(null),
    ];
    const ciks = responses.map((_, index) =>
      String(index + 1).padStart(10, "0"),
    );
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: mockedFetch((_cik, index) => responses[index]!),
      }).loadFilings(ciks, FROM, THROUGH),
    );
    expect(result.every((value) => value.status === "invalid_response")).toBe(
      true,
    );
    expect(canceled).toHaveBeenCalledTimes(1);
  });

  it("rejects redirect and changed-origin results without fetching another URL", async () => {
    const fetch = mockedFetch((cik, index) => {
      if (index === 0)
        return Response.redirect("https://private.example.test/canary");
      const response = Response.json(payload(cik));
      Object.defineProperty(response, index === 1 ? "redirected" : "url", {
        value: index === 1 ? true : "https://private.example.test/canary",
      });
      return response;
    });
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
        [CIK, "0000000007", "0000000008"],
        FROM,
        THROUGH,
      ),
    );
    expect(result.every((value) => value.status !== "available")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      fetch.mock.calls.every(([url]) =>
        requestUrl(url).startsWith("https://data.sec.gov/submissions/CIK"),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("canary");
  });

  it("validates issuer and date boundaries before network calls", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const invalidCiks = [
      [],
      new Array<string>(1),
      [CIK, CIK],
      ["42"],
      ["0000000000"],
      ["0000000042/../../secret"],
      [42],
      Array.from({ length: 21 }, (_, index) =>
        String(index + 1).padStart(10, "0"),
      ),
      null,
    ];
    for (const ciks of invalidCiks) {
      await expect(
        provider.loadFilings(ciks as readonly string[], FROM, THROUGH),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    for (const [from, through] of [
      [THROUGH, FROM],
      ["2026-02-30", THROUGH],
      [FROM, "2026-09-10"],
      ["2026-06-11", THROUGH],
      [FROM, "2026-09-09T00:00:00Z"],
      ["no-date-canary", THROUGH],
    ]) {
      await expect(
        provider.loadFilings([CIK], from!, through!),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(
      (await finish(provider.loadFilings([CIK], "2026-06-12", THROUGH)))[0]
        ?.status,
    ).toBe("available");
    expect(
      (await finish(provider.loadFilings([CIK], THROUGH, THROUGH)))[0]?.status,
    ).toBe("available");
  });

  it("rejects invalid clocks and dependency implementations", async () => {
    const fetch = mockedFetch();
    for (const now of [
      () => new Date(NaN),
      () => new Date("2009-01-01T00:00:00Z"),
    ]) {
      await expect(
        createSecPersonalFilingsProvider(USER_AGENT, {
          fetch,
          now,
        }).loadFilings([CIK], FROM, THROUGH),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    expect(() =>
      createSecPersonalFilingsProvider(USER_AGENT, {
        fetch: 3 as unknown as typeof globalThis.fetch,
      }),
    ).toThrow(TypeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows only one batch at a time and copies caller-owned issuer selections", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const selected = [CIK, "0000000007"];
    const pending = provider.loadFilings(selected, FROM, THROUGH);
    selected[1] = "0000000008";
    await expect(
      provider.loadFilings([CIK], FROM, THROUGH),
    ).rejects.toMatchObject({ code: "busy" });
    const result = await finish(pending);
    expect(result.map((issuer) => issuer.cik)).toEqual([CIK, "0000000007"]);
    await finish(provider.loadFilings([CIK], FROM, THROUGH));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("aborts active transport, releases busy and stops subsequent issuer requests", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise<Response>(() => undefined),
    );
    const provider = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const controller = new AbortController();
    const pending = provider.loadFilings(
      [CIK, "0000000007"],
      FROM,
      THROUGH,
      controller.signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      provider.loadFilings([CIK], FROM, THROUGH, controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    fetch.mockImplementation((input) =>
      Promise.resolve(
        Response.json(payload(requestUrl(input).match(/CIK(\d{10})/u)?.[1])),
      ),
    );
    expect(
      (await finish(provider.loadFilings([CIK], FROM, THROUGH)))[0]?.status,
    ).toBe("available");
  });

  it("close aborts an active body and makes later calls unavailable", async () => {
    const canceled = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({ start() {}, cancel: canceled }),
        ),
      ),
    );
    const provider = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const pending = provider.loadFilings([CIK], FROM, THROUGH);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    await vi.advanceTimersByTimeAsync(0);
    provider.close();
    await rejected;
    expect(canceled).toHaveBeenCalledTimes(1);
    expect(provider.status()).toEqual({ configured: false });
    await expect(
      provider.loadFilings([CIK], FROM, THROUGH),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("applies a total ten-second deadline to fetch and body and preserves independent issuer success", async () => {
    let index = 0;
    const canceled = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>((input) => {
      if (index++ === 0) return new Promise<Response>(() => undefined);
      if (index === 2)
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({ start() {}, cancel: canceled }),
          ),
        );
      return Promise.resolve(
        Response.json(payload(requestUrl(input).match(/CIK(\d{10})/u)?.[1])),
      );
    });
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
        [CIK, "0000000007", "0000000008"],
        FROM,
        THROUGH,
      ),
    );
    expect(result.map((value) => value.status)).toEqual([
      "upstream_unavailable",
      "upstream_unavailable",
      "available",
    ]);
    expect(
      fetch.mock.calls.slice(0, 2).every(([, init]) => init?.signal?.aborted),
    ).toBe(true);
    expect(canceled).toHaveBeenCalledTimes(1);
    expect(Date.now() - NOW.getTime()).toBe(20_600);
  });

  it("does not expose rejected transport exception details", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.reject(new Error("provider-secret-canary")),
    );
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
        [CIK],
        FROM,
        THROUGH,
      ),
    );
    expect(result[0]?.status).toBe("upstream_unavailable");
    expect(JSON.stringify(result)).not.toContain("canary");
  });

  it("does not reset the ten-second deadline when headers arrive", async () => {
    const canceled = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(
                  new ReadableStream<Uint8Array>({
                    start() {},
                    cancel: canceled,
                  }),
                ),
              ),
            9_000,
          );
        }),
    );
    const result = await finish(
      createSecPersonalFilingsProvider(USER_AGENT, { fetch }).loadFilings(
        [CIK],
        FROM,
        THROUGH,
      ),
    );
    expect(result[0]?.status).toBe("upstream_unavailable");
    expect(Date.now() - NOW.getTime()).toBe(10_000);
    expect(canceled).toHaveBeenCalledTimes(1);
  });
});
