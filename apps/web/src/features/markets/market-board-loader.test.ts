import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  createMarketBoardRefreshBudget,
  loadMarketBoard,
  MARKET_BOARD_SEEDS,
  type MarketBoardDependencies,
} from "./market-board-loader";

const digest = `sha256:${"a".repeat(64)}` as const;
function identity(symbol: string): PersonalSecurityMasterSearchResultDto {
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    matchKind: "current_symbol_exact",
    matchedValue: symbol,
    securityId: `security-${symbol}`,
    securityName: "Common stock",
    shareClassId: `class-${symbol}`,
    shareClassName: "Common",
    symbol,
  };
}
function overview(symbol: string): PersonalMarketOverviewDto {
  const row = identity(symbol);
  const window = {
    range: "1m",
    startDate: "2026-08-24",
    endDate: "2026-09-24",
  } as const;
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    ingestedAt: "2026-09-24T23:00:00.000Z",
    security: {
      country: row.country,
      exchangeMic: row.exchangeMic,
      issuerName: row.issuerName,
      listingId: row.listingId,
      securityName: row.securityName,
      symbol,
    },
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
    window,
    quote: { status: "not_requested" },
    history: {
      status: "available",
      value: { ...window, currency: "USD", bars: [] },
    },
  };
}
function setup() {
  const search = vi.fn<MarketBoardDependencies["search"]>((symbol) =>
    Promise.resolve({
      results: [identity(symbol)],
      snapshot: { snapshotSha256: digest },
    }),
  );
  const fetch = vi.fn<MarketBoardDependencies["overview"]>(({ symbol }) =>
    Promise.resolve(overview(symbol)),
  );
  return {
    search,
    overview: fetch,
    now: () => new Date("2026-09-25T00:00:00.000Z"),
  };
}
describe("Markets board loading", () => {
  it("resolves only its declared cohort and loads one history-only request per identity", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    const loaded = await loadMarketBoard(
      digest,
      controller.signal,
      dependencies,
    );
    expect(loaded.rows.map((row) => row.symbol)).toEqual(MARKET_BOARD_SEEDS);
    expect(loaded.loadedAt).toBe("2026-09-25T00:00:00.000Z");
    expect(dependencies.overview.mock.calls.map(([input]) => input)).toEqual(
      MARKET_BOARD_SEEDS.map((symbol) => ({
        listingId: `listing-${symbol}`,
        symbol,
        range: "1m",
        includeQuote: false,
      })),
    );
    expect(Object.isFrozen(loaded.rows)).toBe(true);
  });
  it("does not acquire a missing or ambiguous seed", async () => {
    const dependencies = setup();
    dependencies.search.mockImplementation((symbol) =>
      Promise.resolve({
        results:
          symbol === "AAPL"
            ? []
            : [identity(symbol), { ...identity(symbol), listingId: "second" }],
        snapshot: { snapshotSha256: digest },
      }),
    );
    const loaded = await loadMarketBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    expect(loaded.rows.every((row) => row.error === "not_in_catalog")).toBe(
      true,
    );
    expect(dependencies.overview).not.toHaveBeenCalled();
  });
  it("rejects a catalog generation change without returning earlier rows", async () => {
    const dependencies = setup();
    dependencies.search
      .mockResolvedValueOnce({
        results: [identity("AAPL")],
        snapshot: { snapshotSha256: digest },
      })
      .mockResolvedValueOnce({
        results: [identity("MSFT")],
        snapshot: { snapshotSha256: `sha256:${"b".repeat(64)}` },
      });
    await expect(
      loadMarketBoard(digest, new AbortController().signal, dependencies),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(dependencies.overview).toHaveBeenCalledTimes(1);
  });
  it("keeps completed rows and stops further requests on a shared access refusal", async () => {
    const dependencies = setup();
    dependencies.overview.mockImplementation(({ symbol }) =>
      Promise.resolve(
        symbol === "MSFT"
          ? {
              ...overview(symbol),
              history: { status: "unavailable", reason: "access_denied" },
            }
          : overview(symbol),
      ),
    );
    const loaded = await loadMarketBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    expect(loaded.rows.map((row) => row.error)).toEqual([
      null,
      "access_denied",
      "not_requested",
    ]);
    expect(loaded.rows[0]?.overview?.history.status).toBe("available");
    expect(dependencies.search).toHaveBeenCalledTimes(2);
    expect(dependencies.overview).toHaveBeenCalledTimes(2);
  });
  it.each(["not_covered", "upstream_unavailable", "invalid_response"] as const)(
    "retains individual %s errors and continues",
    async (reason) => {
      const dependencies = setup();
      dependencies.overview.mockResolvedValueOnce({
        ...overview("AAPL"),
        history: { status: "unavailable", reason },
      });
      const loaded = await loadMarketBoard(
        digest,
        new AbortController().signal,
        dependencies,
      );
      expect(loaded.rows[0]?.error).not.toBeNull();
      expect(loaded.rows[2]?.error).toBeNull();
      expect(loaded.stoppedBy).toBeNull();
    },
  );
  it.each([
    "credentials_invalid",
    "access_denied",
    "rate_limited",
    "not_configured",
  ] as const)("stops transport-level %s without a retry", async (code) => {
    const dependencies = setup();
    dependencies.overview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError(code),
    );
    const loaded = await loadMarketBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    expect(loaded.stoppedBy).toBe(code);
    expect(dependencies.overview).toHaveBeenCalledTimes(1);
    expect(dependencies.search).toHaveBeenCalledTimes(1);
  });
  it("rejects session loss rather than returning retained private data", async () => {
    const dependencies = setup();
    dependencies.overview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await expect(
      loadMarketBoard(digest, new AbortController().signal, dependencies),
    ).rejects.toMatchObject({ code: "session_unavailable" });
  });
  it.each([
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)("withholds an overview with mismatched %s", async (key) => {
    const dependencies = setup();
    const response = overview("AAPL");
    dependencies.overview.mockResolvedValueOnce({
      ...response,
      security: { ...response.security, [key]: "wrong" },
    });
    const loaded = await loadMarketBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    expect(loaded.rows[0]).toMatchObject({
      error: "invalid_response",
      overview: null,
    });
  });
  it("aborts a delayed identity resolution before provider acquisition", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    dependencies.search.mockImplementation(() => {
      controller.abort();
      return Promise.resolve({
        results: [identity("AAPL")],
        snapshot: { snapshotSha256: digest },
      });
    });
    await expect(
      loadMarketBoard(digest, controller.signal, dependencies),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(dependencies.overview).not.toHaveBeenCalled();
  });
  it("aborts a late overview before returning rows or starting another request", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    dependencies.overview.mockImplementation(({ symbol }) => {
      controller.abort();
      return Promise.resolve(overview(symbol));
    });
    await expect(
      loadMarketBoard(digest, controller.signal, dependencies),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(dependencies.search).toHaveBeenCalledTimes(1);
  });
  it("loads sequentially, never starting the next catalog search before the first overview settles", async () => {
    const dependencies = setup();
    let release!: (value: PersonalMarketOverviewDto) => void;
    dependencies.overview.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = loadMarketBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(dependencies.search).toHaveBeenCalledTimes(1);
    release(overview("AAPL"));
    await pending;
    expect(dependencies.search).toHaveBeenCalledTimes(3);
  });
  it.each(
    [[], ["AAPL", "AAPL"], ["A", "B", "C", "D", "E", "F", "G"], ["aapl"]].map(
      (seeds) => [seeds],
    ),
  )("rejects invalid board definitions before IO: %j", async (seeds) => {
    const dependencies = setup();
    await expect(
      loadMarketBoard(
        digest,
        new AbortController().signal,
        dependencies,
        seeds,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(dependencies.search).not.toHaveBeenCalled();
  });
});
describe("Markets refresh budget", () => {
  it("permits one start per 15 minutes and four per rolling hour", () => {
    const budget = createMarketBoardRefreshBudget();
    expect(budget.start(0)).toBe(true);
    expect(budget.start(0)).toBe(false);
    expect(budget.start(899999)).toBe(false);
    expect(budget.nextAllowedAt(1)).toBe(900000);
    for (const time of [900000, 1800000, 2700000])
      expect(budget.start(time)).toBe(true);
    expect(budget.start(3599999)).toBe(false);
    expect(budget.start(3600000)).toBe(true);
  });
  it("rejects a nonfinite clock and a backwards clock without granting extra starts", () => {
    const budget = createMarketBoardRefreshBudget();
    expect(budget.start(NaN)).toBe(false);
    expect(budget.start(Infinity)).toBe(false);
    expect(budget.start(1000)).toBe(true);
    expect(budget.start(0)).toBe(false);
    expect(budget.nextAllowedAt(0)).toBe(901000);
  });
});
