import type {
  PersonalMarketDataIdentityDto,
  PersonalMarketDataRangeDto,
} from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createTiingoPersonalMarketDataProvider,
  PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY,
  PersonalMarketDataProviderError,
} from "./personal-market-data-provider";

const NOW = new Date("2026-09-07T18:00:00.000Z");
const TOKEN = "private-tiingo-token-canary";
const IDENTITY = Object.freeze({
  country: "US",
  exchangeMic: "XNYS",
  issuerName: "Berkshire Hathaway Inc.",
  listingId: "listing-brk-b",
  securityName: "Class B Common Stock",
  symbol: "BRK.B",
}) satisfies PersonalMarketDataIdentityDto;

interface FetchCall {
  readonly init: RequestInit | undefined;
  readonly url: string;
}

describe("Tiingo personal market-data provider", () => {
  it("reports only public provider status and fails closed without a token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const provider = createTiingoPersonalMarketDataProvider(undefined, {
      fetch: fetchImplementation,
      now: () => NOW,
    });

    expect(PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY).toBe(
      "PERSONAL_MARKET_DATA_TIINGO_TOKEN",
    );
    expect(provider.getStatus()).toEqual({
      profile: "personal_single_user_local_market_data",
      provider: {
        attribution: "Tiingo",
        export: "prohibited",
        historyFeed: "tiingo_eod_composite",
        id: "tiingo",
        name: "Tiingo",
        persistence: "none",
        quoteFeed: "tiingo_iex_derived_reference",
        redistribution: "prohibited",
        retention: "active_owner_session_memory_only",
      },
      schemaVersion: "1.0.0",
      status: "not_configured",
    });
    expect(provider.status()).toEqual(provider.getStatus());
    expect(Object.isFrozen(provider.getStatus())).toBe(true);

    await expect(provider.loadOverview(IDENTITY, "1m")).rejects.toMatchObject({
      code: "not_configured",
      message: "Personal market data is unavailable.",
      name: "PersonalMarketDataProviderError",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("uses only fixed Tiingo HTTPS routes and header-only credentials", async () => {
    const calls: FetchCall[] = [];
    const fetchImplementation = mockTiingoFetch(
      [quotePayload()],
      [dailyBar("2026-09-05"), dailyBar("2026-09-07", { close: 108 })],
      calls,
    );
    const consoleSpies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
    try {
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: fetchImplementation,
        now: () => NOW,
      });
      const result = await provider.loadOverview(IDENTITY, "1m");

      expect(provider.getStatus().status).toBe("configured");
      expect(calls).toHaveLength(2);
      expect(calls.map(({ url }) => url)).toEqual([
        "https://api.tiingo.com/iex/BRK-B",
        "https://api.tiingo.com/tiingo/daily/BRK-B/prices?startDate=2026-08-07&endDate=2026-09-07",
      ]);
      for (const call of calls) {
        const url = new URL(call.url);
        const headers = new Headers(call.init?.headers);
        expect(url.origin).toBe("https://api.tiingo.com");
        expect(url.username).toBe("");
        expect(url.password).toBe("");
        expect(call.url).not.toContain(TOKEN);
        expect(headers.get("authorization")).toBe(`Token ${TOKEN}`);
        expect(headers.get("accept")).toBe("application/json");
        expect(call.init).toMatchObject({
          cache: "no-store",
          credentials: "omit",
          method: "GET",
          redirect: "error",
          referrerPolicy: "no-referrer",
        });
      }
      expect(result.security.symbol).toBe("BRK.B");
      expect(result.provider.id).toBe("tiingo");
      expect(result.history).toMatchObject({
        endDate: "2026-09-07",
        range: "1m",
        startDate: "2026-08-07",
      });
      expect(result.quote).toEqual({
        change: "2",
        changePercent: "1.9047619047619",
        currency: "USD",
        freshness: "current",
        ingestedAt: NOW.toISOString(),
        kind: "derived_realtime_reference",
        previousClose: "105",
        price: "107",
        sourceTime: "2026-09-07T17:58:00.000Z",
      });
      expect(result.history.bars[1]).toEqual({
        adjusted: {
          close: "104",
          high: "109",
          low: "94",
          open: "99",
          volume: "1010",
        },
        date: "2026-09-07",
        dividendCash: "0",
        raw: {
          close: "108",
          high: "110",
          low: "95",
          open: "100",
          volume: "1000",
        },
        splitFactor: "1",
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.history.bars)).toBe(true);
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(
        true,
      );
    } finally {
      for (const spy of consoleSpies) spy.mockRestore();
    }
  });

  it.each([
    ["1m", "2026-08-07"],
    ["3m", "2026-06-07"],
    ["ytd", "2026-01-01"],
    ["1y", "2025-09-07"],
    ["5y", "2021-09-07"],
    ["10y", "2016-09-07"],
  ] satisfies readonly (readonly [PersonalMarketDataRangeDto, string])[])(
    "uses the explicit %s calendar range",
    async (range, expectedStartDate) => {
      const calls: FetchCall[] = [];
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: mockTiingoFetch(
          [quotePayload()],
          [dailyBar("2026-09-07")],
          calls,
        ),
        now: () => NOW,
      });
      const result = await provider.loadOverview(IDENTITY, range);
      const historyUrl = new URL(calls[1]?.url ?? "about:blank");
      expect(historyUrl.searchParams.get("startDate")).toBe(expectedStartDate);
      expect(historyUrl.searchParams.get("endDate")).toBe("2026-09-07");
      expect(result.history.startDate).toBe(expectedStartDate);
      expect(result.history.endDate).toBe("2026-09-07");
    },
  );

  it("clamps calendar ranges at month and leap-year boundaries", async () => {
    for (const [now, range, expected] of [
      [new Date("2025-03-31T12:00:00.000Z"), "1m", "2025-02-28"],
      [new Date("2024-02-29T12:00:00.000Z"), "1y", "2023-02-28"],
    ] as const) {
      const calls: FetchCall[] = [];
      const day = now.toISOString().slice(0, 10);
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: mockTiingoFetch(
          [quotePayload({ timestamp: now.toISOString() })],
          [dailyBar(day)],
          calls,
        ),
        now: () => now,
      });
      await provider.loadOverview(IDENTITY, range);
      expect(
        new URL(calls[1]?.url ?? "about:blank").searchParams.get("startDate"),
      ).toBe(expected);
    }
  });

  it("falls back to the latest EOD close and labels stale data honestly", async () => {
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: mockTiingoFetch(
        [quotePayload({ tngoLast: null })],
        [
          dailyBar("2026-09-03", {
            close: 100,
            high: 101,
            low: 97,
            open: 98,
          }),
          dailyBar("2026-09-04", {
            close: 105,
            high: 106,
            low: 100,
            open: 101,
          }),
        ],
      ),
      now: () => NOW,
    });

    const result = await provider.loadOverview(IDENTITY, "1m");
    expect(result.quote).toEqual({
      change: "5",
      changePercent: "5",
      currency: "USD",
      freshness: "older_than_36_hours",
      ingestedAt: NOW.toISOString(),
      kind: "end_of_day_close",
      previousClose: "100",
      price: "105",
      sourceTime: "2026-09-04T20:00:00.000Z",
    });
  });

  it.each([
    [4, 400, 102, "100", "2", "2"],
    [0.1, 10, 102, "100", "2", "2"],
  ] as const)(
    "normalizes EOD fallback change across split factor %s",
    async (
      splitFactor,
      priorClose,
      latestClose,
      expectedPrevious,
      expectedChange,
      expectedPercent,
    ) => {
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: mockTiingoFetch(
          [quotePayload({ tngoLast: null })],
          [
            dailyBar("2026-09-03", {
              close: priorClose,
              high: priorClose + 2,
              low: priorClose - 2,
              open: priorClose,
            }),
            dailyBar("2026-09-04", {
              close: latestClose,
              high: latestClose + 2,
              low: latestClose - 2,
              open: latestClose,
              splitFactor,
            }),
          ],
        ),
        now: () => NOW,
      });

      await expect(
        provider.loadOverview(IDENTITY, "1m"),
      ).resolves.toMatchObject({
        quote: {
          change: expectedChange,
          changePercent: expectedPercent,
          previousClose: expectedPrevious,
        },
      });
    },
  );

  it.each([
    ["2026-01-07", "2026-01-07T21:00:00.000Z"],
    ["2026-03-09", "2026-03-09T20:00:00.000Z"],
    ["2026-09-04", "2026-09-04T20:00:00.000Z"],
    ["2026-11-02", "2026-11-02T21:00:00.000Z"],
  ] as const)(
    "models EOD session %s at the US regular close",
    async (date, expectedSourceTime) => {
      const now = new Date(
        `${date}T${expectedSourceTime.includes("T20:") ? "21" : "22"}:00:00.000Z`,
      );
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: mockTiingoFetch(
          [quotePayload({ timestamp: now.toISOString(), tngoLast: null })],
          [dailyBar(date)],
        ),
        now: () => now,
      });

      await expect(
        provider.loadOverview(IDENTITY, "1m"),
      ).resolves.toMatchObject({
        quote: {
          freshness: "current",
          sourceTime: expectedSourceTime,
        },
      });
    },
  );

  it("accepts additive provider fields while requiring the known schema", async () => {
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: mockTiingoFetch(
        [quotePayload({ additiveQuoteField: { ignored: true } })],
        [dailyBar("2026-09-07", { additiveBarField: "ignored" })],
      ),
      now: () => NOW,
    });

    await expect(provider.loadOverview(IDENTITY, "1m")).resolves.toMatchObject({
      quote: { price: "107" },
      status: "available",
    });

    const missingRequiredProvider = createTiingoPersonalMarketDataProvider(
      TOKEN,
      {
        fetch: mockTiingoFetch(
          [quotePayload()],
          [without(dailyBar("2026-09-07"), "splitFactor")],
        ),
        now: () => NOW,
      },
    );
    await expect(
      missingRequiredProvider.loadOverview(IDENTITY, "1m"),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    ["2026-09-07T17:58:00+00:00", "2026-09-07T17:58:00.000Z"],
    ["2026-09-07T13:58:00.123456789-04:00", "2026-09-07T17:58:00.123Z"],
    ["2026-01-07T12:58:00.987654321-05:00", "2026-01-07T17:58:00.987Z"],
  ] as const)(
    "normalizes Tiingo instant %s to canonical UTC",
    async (timestamp, expected) => {
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: mockTiingoFetch(
          [quotePayload({ timestamp })],
          [
            dailyBar("2026-09-07", {
              date: "2026-09-07T00:00:00+00:00",
            }),
          ],
        ),
        now: () => NOW,
      });

      const result = await provider.loadOverview(IDENTITY, "1m");
      expect(result.quote.sourceTime).toBe(expected);
      expect(result.history.bars[0]?.date).toBe("2026-09-07");
    },
  );

  it.each([
    "2026-02-30T13:58:00-04:00",
    "2026-09-07T24:00:00-04:00",
    "2026-09-07T13:58:00-24:00",
    "2026-09-07T13:58:00-04:60",
  ])("rejects malformed Tiingo instant %s", async (timestamp) => {
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: mockTiingoFetch(
        [quotePayload({ timestamp })],
        [dailyBar("2026-09-07")],
      ),
      now: () => NOW,
    });

    await expect(provider.loadOverview(IDENTITY, "1m")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    [401, "credentials_invalid"],
    [403, "credentials_invalid"],
    [404, "not_covered"],
    [429, "rate_limited"],
    [500, "upstream_unavailable"],
  ] as const)("maps Tiingo HTTP %i to %s", async (status, code) => {
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: () => Promise.resolve(new Response("{}", { status })),
      now: () => NOW,
    });

    const error = await provider
      .loadOverview(IDENTITY, "1m")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PersonalMarketDataProviderError);
    expect(error).toMatchObject({
      code,
      message: "Personal market data is unavailable.",
    });
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it("rejects oversized, empty, malformed, null, and non-finite responses", async () => {
    const invalidResponses: readonly Response[] = [
      new Response("[]", {
        headers: { "content-length": String(1024 * 1024 + 1) },
      }),
      new Response(null),
      new Response("not-json"),
      jsonResponse([dailyBar("2026-09-07", { open: null })]),
      new Response(nonFiniteDailyBarJson("2026-09-07")),
      new Response(new Uint8Array(1024 * 1024 + 1)),
    ];

    for (const invalidResponse of invalidResponses) {
      let historyRequest = false;
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: (input) => {
          const url = requestUrl(input);
          if (url.includes("/iex/")) {
            return Promise.resolve(jsonResponse([quotePayload()]));
          }
          historyRequest = true;
          return Promise.resolve(invalidResponse);
        },
        now: () => NOW,
      });
      await expect(provider.loadOverview(IDENTITY, "1m")).rejects.toMatchObject(
        { code: "invalid_response" },
      );
      expect(historyRequest).toBe(true);
    }
  });

  it("rejects more than 4,096 EOD bars independently of the byte cap", async () => {
    const bars = Array.from({ length: 4_097 }, () => dailyBar("2026-09-07"));
    expect(
      new TextEncoder().encode(JSON.stringify(bars)).byteLength,
    ).toBeLessThan(1024 * 1024);
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: mockTiingoFetch([quotePayload()], bars),
      now: () => NOW,
    });

    await expect(provider.loadOverview(IDENTITY, "10y")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    [[dailyBar("2026-09-07"), dailyBar("2026-09-06")], "out-of-order dates"],
    [[dailyBar("2026-09-07"), dailyBar("2026-09-07")], "duplicate dates"],
    [[dailyBar("2026-09-07", { high: 99 })], "invalid OHLC bounds"],
    [[dailyBar("2026-09-07", { volume: -1 })], "negative volume"],
  ] as const)("rejects malformed history (%s)", async (bars, reason) => {
    expect(reason.length).toBeGreaterThan(0);
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: mockTiingoFetch([quotePayload()], bars),
      now: () => NOW,
    });
    await expect(provider.loadOverview(IDENTITY, "1m")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("never lets a caller select a host or path through the symbol", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
      fetch: fetchImplementation,
      now: () => NOW,
    });
    const hostileIdentity = {
      ...IDENTITY,
      symbol: "../attacker.example/token",
    } satisfies PersonalMarketDataIdentityDto;

    await expect(
      provider.loadOverview(hostileIdentity, "1m"),
    ).rejects.toMatchObject({ code: "not_covered" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects malformed credentials without reflecting their value", async () => {
    const malformedToken = "private-token\r\nforwarded: secret";
    const fetchImplementation = vi.fn<typeof fetch>();
    const provider = createTiingoPersonalMarketDataProvider(malformedToken, {
      fetch: fetchImplementation,
      now: () => NOW,
    });

    expect(provider.getStatus().status).toBe("configured");
    const error = await provider
      .loadOverview(IDENTITY, "1m")
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "credentials_invalid" });
    expect(String(error)).not.toContain(malformedToken);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("honors caller aborts and aborts in-flight requests when closed", async () => {
    for (const abortOperation of ["caller", "close"] as const) {
      const requestSignals: AbortSignal[] = [];
      const fetchImplementation: typeof fetch = (
        _input: string | URL | Request,
        init?: RequestInit,
      ) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!(signal instanceof AbortSignal)) {
            reject(new Error("missing signal"));
            return;
          }
          requestSignals.push(signal);
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: fetchImplementation,
        now: () => NOW,
      });
      const callerController = new AbortController();
      const pending = provider.loadOverview(
        IDENTITY,
        "1m",
        callerController.signal,
      );
      if (abortOperation === "caller") callerController.abort();
      else provider.close();

      await expect(pending).rejects.toMatchObject({ code: "aborted" });
      expect(requestSignals).toHaveLength(2);
      expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
      if (abortOperation === "close") {
        expect(provider.getStatus().status).toBe("not_configured");
        await expect(
          provider.loadOverview(IDENTITY, "1m"),
        ).rejects.toMatchObject({ code: "not_configured" });
        provider.close();
      }
    }
  });

  it("aborts the transport at the fixed ten-second timeout", async () => {
    vi.useFakeTimers();
    try {
      const requestSignals: AbortSignal[] = [];
      const fetchImplementation: typeof fetch = (
        _input: string | URL | Request,
        init?: RequestInit,
      ) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!(signal instanceof AbortSignal)) {
            reject(new Error("missing signal"));
            return;
          }
          requestSignals.push(signal);
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: fetchImplementation,
        now: () => NOW,
      });
      const pending = provider.loadOverview(IDENTITY, "1m");
      const rejection = expect(pending).rejects.toMatchObject({
        code: "upstream_unavailable",
      });

      await vi.advanceTimersByTimeAsync(9_999);
      expect(requestSignals.every((signal) => !signal.aborted)).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
      expect(requestSignals).toHaveLength(2);
      expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("annual financial statements", () => {
    it("uses one fixed fundamentals request and preserves exact numeric lexemes", async () => {
      const calls: FetchCall[] = [];
      const raw = `[{"date":"2025-12-31","year":2025,"quarter":0,"statementData":{"incomeStatement":[{"dataCode":"revenue","value":9007199254740993},{"dataCode":"netinc","value":1.2300e+5}],"balanceSheet":[{"dataCode":"cashAndEq","value":-2.500e-3}],"cashFlow":[],"overview":[{"dataCode":"marketCap","value":9999999999999999}]}}]`;
      const consoleSpies = [
        vi.spyOn(console, "debug").mockImplementation(() => undefined),
        vi.spyOn(console, "error").mockImplementation(() => undefined),
        vi.spyOn(console, "info").mockImplementation(() => undefined),
        vi.spyOn(console, "log").mockImplementation(() => undefined),
        vi.spyOn(console, "warn").mockImplementation(() => undefined),
      ];
      try {
        const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
          fetch: (input, init) => {
            calls.push(Object.freeze({ init, url: requestUrl(input) }));
            return Promise.resolve(new Response(raw));
          },
          now: () => NOW,
        });

        const result = await provider.loadAnnualFinancials(IDENTITY);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe(
          "https://api.tiingo.com/tiingo/fundamentals/BRK-B/statements?startDate=2015-01-01&endDate=2026-09-07&asReported=false&format=json",
        );
        const headers = new Headers(calls[0]?.init?.headers);
        expect(headers.get("authorization")).toBe(`Token ${TOKEN}`);
        expect(headers.get("accept")).toBe("application/json");
        expect(calls[0]?.url).not.toContain(TOKEN);
        expect(calls[0]?.init).toMatchObject({
          cache: "no-store",
          credentials: "omit",
          method: "GET",
          redirect: "error",
          referrerPolicy: "no-referrer",
        });
        expect(result.years[0]).toMatchObject({
          fiscalYear: 2025,
          statementDate: "2025-12-31",
          reported: {
            cash: { status: "known", value: "-0.0025" },
            net_income: { status: "known", value: "123000" },
            revenue: { status: "known", value: "9007199254740993" },
          },
        });
        expect(result.provider).toEqual({
          attribution: "Tiingo",
          export: "prohibited",
          id: "tiingo",
          name: "Tiingo",
          persistence: "none",
          redistribution: "prohibited",
          retention: "active_owner_session_memory_only",
          revisionBasis: "provider_most_recent",
          statementFeed: "tiingo_fundamentals_statements",
          valueCurrency: "USD",
        });
        expect(result.asOf).toBe(NOW.toISOString());
        expect(result.security.symbol).toBe("BRK.B");
        expect(Object.keys(result.years[0]?.reported ?? {})).toHaveLength(30);
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.years[0]?.reported)).toBe(true);
        expect(JSON.stringify(result)).not.toContain(TOKEN);
        expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(
          true,
        );
      } finally {
        for (const spy of consoleSpies) spy.mockRestore();
      }
    });

    it("validates every record, filters annuals, sorts and caps at ten years", async () => {
      const records = [
        annualRecord(2022, 2),
        ...Array.from({ length: 11 }, (_, index) =>
          annualRecord(2015 + index, 0, {
            incomeStatement: [{ dataCode: "revenue", value: 1_000 + index }],
          }),
        ).reverse(),
      ];
      const provider = annualProvider(records);

      const result = await provider.loadAnnualFinancials(IDENTITY);

      expect(result.years.map(({ fiscalYear }) => fiscalYear)).toEqual([
        2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
      ]);
      expect(result.coverage).toEqual({
        earliestFiscalYear: 2016,
        knownReportedCells: 10,
        latestFiscalYear: 2025,
        missingFiscalYears: [],
        requestedAnnualYears: 10,
        returnedAnnualYears: 10,
        status: "partial",
        unknownReportedCells: 290,
      });
    });

    it("makes absent cells and fiscal-year gaps explicit", async () => {
      const provider = annualProvider([
        annualRecord(2015, 0, {
          incomeStatement: [{ dataCode: "netinc", value: 7 }],
        }),
        annualRecord(2023, 0, {
          cashFlow: [{ dataCode: "ncfo", value: 42 }],
        }),
        annualRecord(2025, 0, {
          incomeStatement: [{ dataCode: "revenue", value: 100 }],
        }),
      ]);

      const result = await provider.loadAnnualFinancials(IDENTITY);

      expect(result.years.map(({ fiscalYear }) => fiscalYear)).toEqual([
        2025, 2023,
      ]);
      expect(result.years[0]?.reported.debt).toEqual({
        reason: "not_supplied_by_provider",
        status: "unknown",
        value: null,
      });
      expect(result.coverage).toEqual({
        earliestFiscalYear: 2023,
        knownReportedCells: 2,
        latestFiscalYear: 2025,
        missingFiscalYears: [2024, 2022, 2021, 2020, 2019, 2018, 2017, 2016],
        requestedAnnualYears: 10,
        returnedAnnualYears: 2,
        status: "partial",
        unknownReportedCells: 58,
      });
    });

    it("rejects a numeric value that cannot fit the canonical response contract", async () => {
      const provider = annualProvider([
        annualRecord(2025, 0, {
          incomeStatement: [{ dataCode: "revenue", value: 1e100 }],
        }),
      ]);

      await expect(
        provider.loadAnnualFinancials(IDENTITY),
      ).rejects.toMatchObject({ code: "invalid_response" });
    });

    it("rejects a stale latest fiscal year before reporting an unqueried year missing", async () => {
      const provider = annualProvider([annualRecord(2023)]);

      await expect(
        provider.loadAnnualFinancials(IDENTITY),
      ).rejects.toMatchObject({ code: "invalid_response" });
    });

    it("rejects malformed JSON with an unquoted numeric object key", async () => {
      const raw = `[{
        "date":"2025-12-31",
        "year":2025,
        "quarter":0,
        "statementData":{
          "incomeStatement":[],
          "balanceSheet":[],
          "cashFlow":[],
          "overview":[]
        },
        1:999
      }]`;
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: () => Promise.resolve(new Response(raw)),
        now: () => NOW,
      });

      await expect(
        provider.loadAnnualFinancials(IDENTITY),
      ).rejects.toMatchObject({ code: "invalid_response" });
    });

    it.each([
      [{ ...annualRecord(2025), year: "2025" }, "quoted year"],
      [{ ...annualRecord(2025), quarter: "0" }, "quoted quarter"],
      [
        annualRecord(2025, 0, {
          incomeStatement: [{ dataCode: "revenue", value: "100" }],
        }),
        "quoted value",
      ],
      [
        annualRecord(2025, 0, {
          incomeStatement: [{ dataCode: 123, value: 100 }],
        }),
        "numeric data code",
      ],
      [{ ...annualRecord(2025), year: 9999 }, "implausible fiscal year"],
    ] as const)(
      "rejects source number type or year mismatch: %s (%s)",
      async (record, reason) => {
        expect(reason).not.toBe("");
        await expect(
          annualProvider([record]).loadAnnualFinancials(IDENTITY),
        ).rejects.toMatchObject({ code: "invalid_response" });
      },
    );

    it("keeps the provider statement date distinct from the fiscal-year label", async () => {
      const provider = annualProvider([
        {
          ...annualRecord(2025, 0, {
            incomeStatement: [{ dataCode: "revenue", value: 100 }],
          }),
          date: "2026-02-20T20:00:00Z",
        },
        { ...annualRecord(2018), date: "2026-03-01" },
      ]);

      const result = await provider.loadAnnualFinancials(IDENTITY);

      expect(result.years[0]).toMatchObject({
        fiscalYear: 2025,
        statementDate: "2026-02-20",
      });
      expect(result.years[1]).toMatchObject({
        fiscalYear: 2018,
        statementDate: "2026-03-01",
      });
    });

    it.each([
      [
        annualRecord(2025, 0, {
          incomeStatement: [
            { dataCode: "revenue", value: 1 },
            { dataCode: "revenue", value: 2 },
          ],
        }),
        "duplicate known code",
      ],
      [
        annualRecord(2025, 0, {
          cashFlow: [{ dataCode: "revenue", value: 1 }],
        }),
        "known code in wrong section",
      ],
      [without(annualRecord(2025), "statementData"), "missing statement data"],
      [
        annualRecord(2025, 0, {
          overview: [{ dataCode: "bad\u0000code", value: 1 }],
        }),
        "invalid data code",
      ],
      [
        annualRecord(2025, 0, {
          incomeStatement: [{ dataCode: "revenue", value: "not-a-number" }],
        }),
        "malformed value",
      ],
    ] as const)("rejects %s (%s)", async (record, reason) => {
      expect(reason).not.toBe("");
      const provider = annualProvider([record]);
      await expect(
        provider.loadAnnualFinancials(IDENTITY),
      ).rejects.toMatchObject({ code: "invalid_response" });
    });

    it("validates and ignores a bounded future provider data code", async () => {
      const provider = annualProvider([
        annualRecord(2025, 0, {
          overview: [{ dataCode: "future_metric", value: 123 }],
        }),
      ]);

      const result = await provider.loadAnnualFinancials(IDENTITY);

      expect(result.years).toHaveLength(1);
      expect(result.coverage.knownReportedCells).toBe(0);
      expect(result.coverage.unknownReportedCells).toBe(30);
      expect(JSON.stringify(result)).not.toContain("future_metric");
    });

    it("rejects duplicate annual years and statement shape limits", async () => {
      for (const records of [
        [annualRecord(2025), annualRecord(2025)],
        Array.from({ length: 65 }, () => annualRecord(2025, 1)),
        [
          annualRecord(2025, 0, {
            overview: Array.from({ length: 129 }, (_, index) => ({
              dataCode: `unknown${index}`,
              value: index,
            })),
          }),
        ],
      ]) {
        await expect(
          annualProvider(records).loadAnnualFinancials(IDENTITY),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    });

    it.each([
      [401, "credentials_invalid"],
      [404, "not_covered"],
      [429, "rate_limited"],
      [500, "upstream_unavailable"],
    ] as const)("maps fundamentals HTTP %i to %s", async (status, code) => {
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: () => Promise.resolve(new Response("{}", { status })),
        now: () => NOW,
      });
      await expect(
        provider.loadAnnualFinancials(IDENTITY),
      ).rejects.toMatchObject({
        code,
        message: "Personal market data is unavailable.",
      });
    });

    it.each([
      [
        "valid credential without fundamentals access",
        () => jsonResponse({ message: "You successfully sent a request" }),
        "not_entitled",
      ],
      [
        "rejected credential",
        () => jsonResponse({ message: "Auth Token was not correct" }),
        "credentials_invalid",
      ],
      [
        "invalid credential-test response",
        () => jsonResponse({ message: "unexpected" }),
        "upstream_unavailable",
      ],
    ] as const)(
      "probes a fundamentals 403 with a %s",
      async (_name, probe, code) => {
        const calls: FetchCall[] = [];
        const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
          fetch: (input, init) => {
            const url = requestUrl(input);
            calls.push(Object.freeze({ init, url }));
            return Promise.resolve(
              url === "https://api.tiingo.com/api/test/"
                ? probe()
                : new Response("{}", { status: 403 }),
            );
          },
          now: () => NOW,
        });

        await expect(
          provider.loadAnnualFinancials(IDENTITY),
        ).rejects.toMatchObject({ code });
        expect(calls.map(({ url }) => url)).toEqual([
          "https://api.tiingo.com/tiingo/fundamentals/BRK-B/statements?startDate=2015-01-01&endDate=2026-09-07&asReported=false&format=json",
          "https://api.tiingo.com/api/test/",
        ]);
        expect(
          calls.every(
            ({ init }) =>
              new Headers(init?.headers).get("authorization") ===
              `Token ${TOKEN}`,
          ),
        ).toBe(true);
        expect(new Headers(calls[1]?.init?.headers).get("content-type")).toBe(
          "application/json",
        );
      },
    );

    it("honors caller abort and close with one fundamentals request", async () => {
      for (const operation of ["caller", "close"] as const) {
        let requestSignal: AbortSignal | undefined;
        const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
          fetch: (_input, init) =>
            new Promise<Response>((_resolve, reject) => {
              requestSignal = init?.signal ?? undefined;
              requestSignal?.addEventListener(
                "abort",
                () => reject(new DOMException("aborted", "AbortError")),
                { once: true },
              );
            }),
          now: () => NOW,
        });
        const caller = new AbortController();
        const pending = provider.loadAnnualFinancials(IDENTITY, caller.signal);
        if (operation === "caller") caller.abort();
        else provider.close();
        await expect(pending).rejects.toMatchObject({ code: "aborted" });
        expect(requestSignal?.aborted).toBe(true);
      }
    });
  });

  describe("quarterly financial statements", () => {
    it("uses one fixed request, preserves decimals, and keeps statement date semantics", async () => {
      const calls: FetchCall[] = [];
      const raw = `[{
        "date":"2026-08-14",
        "year":2026,
        "quarter":2,
        "statementData":{
          "incomeStatement":[{"dataCode":"revenue","value":9007199254740993},{"dataCode":"netinc","value":1.2300e+5}],
          "balanceSheet":[{"dataCode":"cashAndEq","value":-2.500e-3}],
          "cashFlow":[],
          "overview":[]
        }
      }]`;
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: (input, init) => {
          calls.push(Object.freeze({ init, url: requestUrl(input) }));
          return Promise.resolve(new Response(raw));
        },
        now: () => NOW,
      });

      const result = await provider.loadQuarterlyFinancials(IDENTITY);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(
        "https://api.tiingo.com/tiingo/fundamentals/BRK-B/statements?startDate=2015-01-01&endDate=2026-09-07&asReported=false&format=json",
      );
      expect(calls[0]?.init).toMatchObject({
        cache: "no-store",
        credentials: "omit",
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
        `Token ${TOKEN}`,
      );
      expect(result.quarters[0]).toMatchObject({
        fiscalQuarter: 2,
        fiscalYear: 2026,
        statementDate: "2026-08-14",
        reported: {
          cash: { status: "known", value: "-0.0025" },
          net_income: { status: "known", value: "123000" },
          revenue: { status: "known", value: "9007199254740993" },
        },
      });
      expect(Object.keys(result.quarters[0]?.reported ?? {})).toHaveLength(30);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.quarters)).toBe(true);
      expect(JSON.stringify(result)).not.toContain(TOKEN);
    });

    it("does not infer fiscal identity from the provider statement date", async () => {
      const result = await annualProvider([
        annualRecord(2026, 2),
        { ...annualRecord(2023, 4), date: "2026-02-20" },
      ]).loadQuarterlyFinancials(IDENTITY);

      expect(result.quarters[1]).toMatchObject({
        fiscalQuarter: 4,
        fiscalYear: 2023,
        statementDate: "2026-02-20",
      });
    });

    it("sorts and caps quarterly coordinates at the latest sixteen", async () => {
      const records = [
        annualRecord(2025),
        ...quarterCoordinates(2026, 2, 17).map(
          ({ fiscalQuarter, fiscalYear }) =>
            annualRecord(fiscalYear, fiscalQuarter, {
              incomeStatement: [{ dataCode: "revenue", value: 100 }],
            }),
        ),
      ].reverse();
      const result =
        await annualProvider(records).loadQuarterlyFinancials(IDENTITY);

      expect(
        result.quarters.map(
          ({ fiscalQuarter, fiscalYear }) =>
            `${String(fiscalYear)}Q${String(fiscalQuarter)}`,
        ),
      ).toEqual([
        "2026Q2",
        "2026Q1",
        "2025Q4",
        "2025Q3",
        "2025Q2",
        "2025Q1",
        "2024Q4",
        "2024Q3",
        "2024Q2",
        "2024Q1",
        "2023Q4",
        "2023Q3",
        "2023Q2",
        "2023Q1",
        "2022Q4",
        "2022Q3",
      ]);
      expect(result.coverage).toEqual({
        earliestFiscalQuarter: 3,
        earliestFiscalYear: 2022,
        knownReportedCells: 16,
        latestFiscalQuarter: 2,
        latestFiscalYear: 2026,
        missingFiscalQuarters: [],
        requestedQuarterlyPeriods: 16,
        returnedQuarterlyPeriods: 16,
        status: "partial",
        unknownReportedCells: 464,
      });
    });

    it("excludes older records instead of stretching a gapped sixteen-quarter window", async () => {
      const records = quarterCoordinates(2026, 2, 17)
        .filter(
          ({ fiscalQuarter, fiscalYear }) =>
            !(fiscalYear === 2025 && fiscalQuarter === 4),
        )
        .map(({ fiscalQuarter, fiscalYear }) =>
          annualRecord(fiscalYear, fiscalQuarter, {
            incomeStatement: [{ dataCode: "revenue", value: 100 }],
          }),
        );

      const result =
        await annualProvider(records).loadQuarterlyFinancials(IDENTITY);

      expect(result.quarters).toHaveLength(15);
      expect(result.quarters).not.toContainEqual(
        expect.objectContaining({ fiscalQuarter: 2, fiscalYear: 2022 }),
      );
      expect(result.coverage.missingFiscalQuarters).toEqual([
        { fiscalQuarter: 4, fiscalYear: 2025 },
      ]);
      expect(result.coverage).toMatchObject({
        earliestFiscalQuarter: 3,
        earliestFiscalYear: 2022,
        returnedQuarterlyPeriods: 15,
      });
    });

    it("reports the exact missing-coordinate window and absent cells", async () => {
      const result = await annualProvider([
        annualRecord(2025, 4, {
          cashFlow: [{ dataCode: "ncfo", value: 42 }],
        }),
        annualRecord(2026, 2, {
          incomeStatement: [{ dataCode: "revenue", value: 100 }],
        }),
      ]).loadQuarterlyFinancials(IDENTITY);

      expect(result.coverage.missingFiscalQuarters.slice(0, 3)).toEqual([
        { fiscalQuarter: 1, fiscalYear: 2026 },
        { fiscalQuarter: 3, fiscalYear: 2025 },
        { fiscalQuarter: 2, fiscalYear: 2025 },
      ]);
      expect(result.coverage.missingFiscalQuarters).toHaveLength(14);
      expect(result.coverage).toMatchObject({
        earliestFiscalQuarter: 4,
        earliestFiscalYear: 2025,
        knownReportedCells: 2,
        latestFiscalQuarter: 2,
        latestFiscalYear: 2026,
        requestedQuarterlyPeriods: 16,
        returnedQuarterlyPeriods: 2,
        status: "partial",
        unknownReportedCells: 58,
      });
      expect(result.quarters[0]?.reported.debt).toEqual({
        reason: "not_supplied_by_provider",
        status: "unknown",
        value: null,
      });
    });

    it("rejects duplicate coordinates, stale coverage, and out-of-range statement dates", async () => {
      for (const records of [
        [annualRecord(2026, 2), annualRecord(2026, 2)],
        [annualRecord(2023, 4)],
        [{ ...annualRecord(2028, 2), date: "2026-08-14" }],
        [{ ...annualRecord(2026, 2), date: "2014-12-31" }],
      ]) {
        await expect(
          annualProvider(records).loadQuarterlyFinancials(IDENTITY),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    });

    it("honors caller abort for the quarterly request", async () => {
      let requestSignal: AbortSignal | undefined;
      const provider = createTiingoPersonalMarketDataProvider(TOKEN, {
        fetch: (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            requestSignal = init?.signal ?? undefined;
            requestSignal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          }),
        now: () => NOW,
      });
      const caller = new AbortController();
      const pending = provider.loadQuarterlyFinancials(IDENTITY, caller.signal);
      caller.abort();

      await expect(pending).rejects.toMatchObject({ code: "aborted" });
      expect(requestSignal?.aborted).toBe(true);
    });
  });
});

function mockTiingoFetch(
  quote: unknown,
  history: unknown,
  calls: FetchCall[] = [],
): typeof fetch {
  return (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = requestUrl(input);
    calls.push(Object.freeze({ init, url }));
    if (url.startsWith("https://api.tiingo.com/iex/")) {
      return Promise.resolve(jsonResponse(quote));
    }
    if (url.startsWith("https://api.tiingo.com/tiingo/daily/")) {
      return Promise.resolve(jsonResponse(history));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
}

function annualProvider(records: readonly unknown[]) {
  return createTiingoPersonalMarketDataProvider(TOKEN, {
    fetch: () => Promise.resolve(jsonResponse(records)),
    now: () => NOW,
  });
}

function annualRecord(
  year: number,
  quarter = 0,
  sectionOverrides: Readonly<
    Partial<
      Record<
        "balanceSheet" | "cashFlow" | "incomeStatement" | "overview",
        readonly unknown[]
      >
    >
  > = {},
): Record<string, unknown> {
  return {
    date: `${year}-06-30`,
    quarter,
    statementData: {
      balanceSheet: [],
      cashFlow: [],
      incomeStatement: [],
      overview: [],
      ...sectionOverrides,
    },
    year,
  };
}

function quarterCoordinates(
  latestFiscalYear: number,
  latestFiscalQuarter: 1 | 2 | 3 | 4,
  count: number,
): readonly Readonly<{
  fiscalQuarter: 1 | 2 | 3 | 4;
  fiscalYear: number;
}>[] {
  const coordinates: Array<{
    fiscalQuarter: 1 | 2 | 3 | 4;
    fiscalYear: number;
  }> = [];
  let fiscalYear = latestFiscalYear;
  let fiscalQuarter = latestFiscalQuarter;
  for (let index = 0; index < count; index += 1) {
    coordinates.push({ fiscalQuarter, fiscalYear });
    if (fiscalQuarter === 1) {
      fiscalYear -= 1;
      fiscalQuarter = 4;
    } else {
      fiscalQuarter = (fiscalQuarter - 1) as 1 | 2 | 3 | 4;
    }
  }
  return coordinates;
}

function requestUrl(input: string | URL | Request): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function quotePayload(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    prevClose: 105,
    ticker: "BRK-B",
    timestamp: "2026-09-07T17:58:00.000Z",
    tngoLast: 107,
    ...overrides,
  };
}

function dailyBar(
  date: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    adjClose: 104,
    adjHigh: 109,
    adjLow: 94,
    adjOpen: 99,
    adjVolume: 1010,
    close: 105,
    date: `${date}T00:00:00.000Z`,
    divCash: 0,
    high: 110,
    low: 95,
    open: 100,
    splitFactor: 1,
    volume: 1000,
    ...overrides,
  };
}

function nonFiniteDailyBarJson(date: string): string {
  return JSON.stringify([dailyBar(date)]).replace('"open":100', '"open":1e309');
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function without(
  value: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([candidate]) => candidate !== key),
  );
}
