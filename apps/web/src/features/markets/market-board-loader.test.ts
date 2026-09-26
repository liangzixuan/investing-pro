import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  createMarketBoardRefreshBudget,
  admitMarketBoard,
  loadMarketBoard,
  marketBoardCohortKey,
  marketBoardIdentityKey,
  MARKET_BOARD_SEEDS,
  type MarketBoardDependencies,
  type MarketBoardDefinition,
  type MarketBoardMember,
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
function member(symbol: string): MarketBoardMember {
  const row = identity(symbol);
  return {
    country: row.country,
    exchangeMic: row.exchangeMic,
    instrumentType: row.instrumentType,
    issuerId: row.issuerId,
    issuerName: row.issuerName,
    listingId: row.listingId,
    securityId: row.securityId,
    securityName: row.securityName,
    shareClassId: row.shareClassId,
    shareClassName: row.shareClassName,
    symbol: row.symbol,
  };
}
const watchlist = (...symbols: string[]): MarketBoardDefinition => ({
  kind: "watchlist",
  members: symbols.map(member),
});
async function loadDefaultBoard(
  snapshotSha256: string,
  signal: AbortSignal,
  dependencies: MarketBoardDependencies,
) {
  return loadMarketBoard(
    await admitMarketBoard(
      { kind: "default" },
      snapshotSha256,
      signal,
      dependencies,
    ),
    signal,
    dependencies,
  );
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
    listing: vi.fn<MarketBoardDependencies["listing"]>((listingId) =>
      Promise.resolve({
        listing: identity(listingId.replace("listing-", "")),
        snapshot: snapshotReceipt(),
      }),
    ),
    overview: fetch,
    now: () => new Date("2026-09-25T00:00:00.000Z"),
  };
}
describe("Markets board loading", () => {
  it("resolves only its declared cohort and loads one history-only request per identity", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    const loaded = await loadDefaultBoard(
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
    const loaded = await loadDefaultBoard(
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
      loadDefaultBoard(digest, new AbortController().signal, dependencies),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(dependencies.overview).not.toHaveBeenCalled();
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
    const loaded = await loadDefaultBoard(
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
    expect(dependencies.search).toHaveBeenCalledTimes(3);
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
      const loaded = await loadDefaultBoard(
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
    const loaded = await loadDefaultBoard(
      digest,
      new AbortController().signal,
      dependencies,
    );
    expect(loaded.stoppedBy).toBe(code);
    expect(dependencies.overview).toHaveBeenCalledTimes(1);
    expect(dependencies.search).toHaveBeenCalledTimes(3);
  });
  it("rejects session loss rather than returning retained private data", async () => {
    const dependencies = setup();
    dependencies.overview.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await expect(
      loadDefaultBoard(digest, new AbortController().signal, dependencies),
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
    const loaded = await loadDefaultBoard(
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
      loadDefaultBoard(digest, controller.signal, dependencies),
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
      loadDefaultBoard(digest, controller.signal, dependencies),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(dependencies.search).toHaveBeenCalledTimes(3);
  });
  it("finishes all admission before EOD and never overlaps overview requests", async () => {
    const dependencies = setup();
    let release!: (value: PersonalMarketOverviewDto) => void;
    dependencies.overview.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const signal = new AbortController().signal;
    const admission = await admitMarketBoard(
      { kind: "default" },
      digest,
      signal,
      dependencies,
    );
    expect(dependencies.search).toHaveBeenCalledTimes(3);
    expect(dependencies.overview).not.toHaveBeenCalled();
    const pending = loadMarketBoard(admission, signal, dependencies);
    expect(dependencies.overview).toHaveBeenCalledTimes(1);
    release(overview("AAPL"));
    await pending;
    expect(dependencies.overview).toHaveBeenCalledTimes(3);
  });
  it.each([
    watchlist("AAPL", "AAPL"),
    watchlist("A", "B", "C", "D", "E", "F", "G"),
    watchlist("aapl"),
  ])("rejects invalid board definitions before IO: %j", async (definition) => {
    const dependencies = setup();
    await expect(
      admitMarketBoard(
        definition,
        digest,
        new AbortController().signal,
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(dependencies.search).not.toHaveBeenCalled();
    expect(dependencies.listing).not.toHaveBeenCalled();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });
});
describe("Watchlist catalog admission", () => {
  it.each([1, 3, 6])(
    "admits %i ordered exact listings before one EOD-only loop",
    async (count) => {
      const dependencies = setup();
      const symbols = ["F", "E", "D", "C", "B", "A"].slice(0, count);
      const definition = watchlist(...symbols);
      const signal = new AbortController().signal;
      const admitted = await admitMarketBoard(
        definition,
        digest,
        signal,
        dependencies,
      );
      expect(dependencies.search).not.toHaveBeenCalled();
      expect(dependencies.listing.mock.calls).toEqual(
        symbols.map((symbol) => [`listing-${symbol}`, signal]),
      );
      expect(dependencies.overview).not.toHaveBeenCalled();
      expect(admitted.rows.map((row) => row.symbol)).toEqual(symbols);
      expect(admitted.rows.every((row) => row.error === null)).toBe(true);
      expect(admitted.rows[0]?.identity).toEqual({
        ...member(symbols[0]!),
        cik: "0000000001",
      });
      const loaded = await loadMarketBoard(admitted, signal, dependencies);
      expect(dependencies.overview.mock.calls).toEqual(
        symbols.map((symbol) => [
          {
            listingId: `listing-${symbol}`,
            symbol,
            range: "1m",
            includeQuote: false,
          },
          signal,
        ]),
      );
      expect(dependencies.listing).toHaveBeenCalledTimes(count);
      expect(loaded.definition).toBe(admitted.definition);
      expect(loaded.cohortKey).toBe(marketBoardCohortKey(definition, digest));
      expect(loaded.rows.map((row) => row.overview?.security.symbol)).toEqual(
        symbols,
      );
    },
  );

  it("allows an empty watchlist without any local or EOD request", async () => {
    const dependencies = setup();
    const signal = new AbortController().signal;
    const admitted = await admitMarketBoard(
      watchlist(),
      digest,
      signal,
      dependencies,
    );
    expect(admitted.rows).toEqual([]);
    const loaded = await loadMarketBoard(admitted, signal, dependencies);
    expect(loaded.rows).toEqual([]);
    expect(dependencies.search).not.toHaveBeenCalled();
    expect(dependencies.listing).not.toHaveBeenCalled();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "withholds a saved listing when its %s changed",
    async (field) => {
      const dependencies = setup();
      dependencies.listing.mockResolvedValueOnce({
        listing: { ...identity("AAPL"), [field]: "changed" },
        snapshot: snapshotReceipt(),
      });
      const signal = new AbortController().signal;
      const admitted = await admitMarketBoard(
        watchlist("AAPL"),
        digest,
        signal,
        dependencies,
      );
      expect(admitted.rows).toEqual([
        { symbol: "AAPL", identity: null, error: "identity_mismatch" },
      ]);
      await loadMarketBoard(admitted, signal, dependencies);
      expect(dependencies.listing).toHaveBeenCalledOnce();
      expect(dependencies.search).not.toHaveBeenCalled();
      expect(dependencies.overview).not.toHaveBeenCalled();
    },
  );

  it("preserves missing and unsupported members without ticker substitution", async () => {
    const dependencies = setup();
    const adr = { ...member("ADR"), instrumentType: "adr" as const };
    dependencies.listing.mockResolvedValueOnce({
      listing: null,
      snapshot: snapshotReceipt(),
    });
    dependencies.listing.mockResolvedValueOnce({
      listing: { ...adr, cik: "0000000001" },
      snapshot: snapshotReceipt(),
    });
    const signal = new AbortController().signal;
    const admitted = await admitMarketBoard(
      { kind: "watchlist", members: [member("MISSING"), adr] },
      digest,
      signal,
      dependencies,
    );
    const loaded = await loadMarketBoard(admitted, signal, dependencies);
    expect(loaded.rows.map((row) => row.error)).toEqual([
      "not_in_catalog",
      "unsupported_listing",
    ]);
    expect(
      loaded.rows.every(
        (row) => row.identity === null && row.overview === null,
      ),
    ).toBe(true);
    expect(dependencies.search).not.toHaveBeenCalled();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("rejects duplicate venue/symbol pairs before any catalog work", async () => {
    const dependencies = setup();
    await expect(
      admitMarketBoard(
        {
          kind: "watchlist",
          members: [
            member("AAPL"),
            { ...member("AAPL"), listingId: "other-listing" },
          ],
        },
        digest,
        new AbortController().signal,
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(dependencies.listing).not.toHaveBeenCalled();
    expect(dependencies.search).not.toHaveBeenCalled();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("admits the same symbol on distinct venues by its exact listing", async () => {
    const dependencies = setup();
    const members = [
      member("ABC"),
      { ...member("ABC"), listingId: "listing-other", exchangeMic: "XNYS" },
    ];
    dependencies.listing.mockImplementation((id) =>
      Promise.resolve({
        listing: {
          ...members.find((row) => row.listingId === id)!,
          cik: "0000000001",
        },
        snapshot: snapshotReceipt(),
      }),
    );
    dependencies.overview.mockImplementation(({ listingId, symbol }) => {
      const source = members.find((row) => row.listingId === listingId)!;
      const response = overview(symbol);
      return Promise.resolve({
        ...response,
        security: {
          ...response.security,
          listingId,
          exchangeMic: source.exchangeMic,
        },
      });
    });
    const signal = new AbortController().signal;
    const admitted = await admitMarketBoard(
      { kind: "watchlist", members },
      digest,
      signal,
      dependencies,
    );
    const loaded = await loadMarketBoard(admitted, signal, dependencies);
    expect(loaded.rows.map((row) => row.identity?.listingId)).toEqual([
      "listing-ABC",
      "listing-other",
    ]);
    expect(loaded.rows.every((row) => row.error === null)).toBe(true);
    expect(dependencies.overview).toHaveBeenCalledTimes(2);
  });

  it("rejects duplicate catalog listing IDs across default results before EOD", async () => {
    const dependencies = setup();
    dependencies.search.mockImplementation((symbol) =>
      Promise.resolve({
        results: [{ ...identity(symbol), listingId: "repeated-listing" }],
        snapshot: { snapshotSha256: digest },
      }),
    );
    await expect(
      admitMarketBoard(
        { kind: "default" },
        digest,
        new AbortController().signal,
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it.each(["conflict", "session_unavailable"] as const)(
    "retires admission on %s without EOD",
    async (code) => {
      const dependencies = setup();
      dependencies.listing.mockResolvedValueOnce({
        listing: identity("AAPL"),
        snapshot: snapshotReceipt(),
      });
      dependencies.listing.mockRejectedValueOnce(
        new PersonalWorkspaceApiError(code),
      );
      await expect(
        admitMarketBoard(
          watchlist("AAPL", "MSFT", "WMT"),
          digest,
          new AbortController().signal,
          dependencies,
        ),
      ).rejects.toMatchObject({ code });
      expect(dependencies.listing).toHaveBeenCalledTimes(2);
      expect(dependencies.overview).not.toHaveBeenCalled();
    },
  );

  it("rejects a replaced exact-listing catalog before EOD", async () => {
    const dependencies = setup();
    dependencies.listing.mockResolvedValueOnce({
      listing: identity("AAPL"),
      snapshot: {
        ...snapshotReceipt(),
        snapshotSha256: `sha256:${"b".repeat(64)}`,
      },
    });
    await expect(
      admitMarketBoard(
        watchlist("AAPL", "MSFT"),
        digest,
        new AbortController().signal,
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(dependencies.listing).toHaveBeenCalledOnce();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("keeps a local lookup error explicit while loading another admitted member", async () => {
    const dependencies = setup();
    dependencies.listing.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("unavailable"),
    );
    const signal = new AbortController().signal;
    const admitted = await admitMarketBoard(
      watchlist("AAPL", "MSFT"),
      digest,
      signal,
      dependencies,
    );
    const loaded = await loadMarketBoard(admitted, signal, dependencies);
    expect(loaded.rows.map((row) => row.error)).toEqual(["unavailable", null]);
    expect(dependencies.overview).toHaveBeenCalledExactlyOnceWith(
      {
        listingId: "listing-MSFT",
        symbol: "MSFT",
        range: "1m",
        includeQuote: false,
      },
      signal,
    );
  });

  it("rejects invalid catalog keys before local work", async () => {
    const dependencies = setup();
    await expect(
      admitMarketBoard(
        watchlist("AAPL"),
        "not-a-digest",
        new AbortController().signal,
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(dependencies.listing).not.toHaveBeenCalled();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("rejects a late exact lookup after abort and never starts the next member", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    let release!: (
      value: Awaited<ReturnType<MarketBoardDependencies["listing"]>>,
    ) => void;
    dependencies.listing.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = admitMarketBoard(
      watchlist("AAPL", "MSFT"),
      digest,
      controller.signal,
      dependencies,
    );
    controller.abort();
    release({ listing: identity("AAPL"), snapshot: snapshotReceipt() });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(dependencies.listing).toHaveBeenCalledOnce();
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("honors cancellation between admission and acquisition", async () => {
    const dependencies = setup();
    const controller = new AbortController();
    const admitted = await admitMarketBoard(
      watchlist("AAPL"),
      digest,
      controller.signal,
      dependencies,
    );
    controller.abort();
    await expect(
      loadMarketBoard(admitted, controller.signal, dependencies),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(dependencies.overview).not.toHaveBeenCalled();
  });

  it("captures immutable identity copies before the first await", async () => {
    const dependencies = setup();
    const selected = { ...member("AAPL") };
    const members = [selected];
    const catalog = identity("AAPL");
    dependencies.listing.mockImplementation(() => {
      selected.issuerName = "Changed while awaiting";
      members.push(member("MSFT"));
      return Promise.resolve({ listing: catalog, snapshot: snapshotReceipt() });
    });
    const admitted = await admitMarketBoard(
      { kind: "watchlist", members },
      digest,
      new AbortController().signal,
      dependencies,
    );
    Object.assign(catalog, { issuerName: "Changed after admission" });
    expect(admitted.definition).toEqual(watchlist("AAPL"));
    expect(admitted.rows[0]?.identity?.issuerName).toBe("Synthetic AAPL");
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted.definition)).toBe(true);
    if (admitted.definition.kind === "watchlist") {
      expect(Object.isFrozen(admitted.definition.members)).toBe(true);
      expect(Object.isFrozen(admitted.definition.members[0])).toBe(true);
    }
    expect(Object.isFrozen(admitted.rows)).toBe(true);
    expect(Object.isFrozen(admitted.rows[0])).toBe(true);
    expect(Object.isFrozen(admitted.rows[0]?.identity)).toBe(true);
    expect(dependencies.listing).toHaveBeenCalledOnce();
  });
});

describe("Markets cohort identity", () => {
  it("uses a fixed field order and changes for each identity field", () => {
    const original = member("AAPL");
    const reordered = Object.fromEntries(
      Object.entries(original).reverse(),
    ) as MarketBoardMember;
    expect(marketBoardIdentityKey(reordered)).toBe(
      marketBoardIdentityKey(original),
    );
    for (const field of Object.keys(original) as (keyof MarketBoardMember)[]) {
      expect(
        marketBoardIdentityKey({ ...original, [field]: "changed" }),
      ).not.toBe(marketBoardIdentityKey(original));
    }
  });
  it("distinguishes catalog, mode, selection order and exact member identities", () => {
    const original = marketBoardCohortKey(watchlist("AAPL", "MSFT"), digest);
    expect(marketBoardCohortKey(watchlist("AAPL", "MSFT"), digest)).toBe(
      original,
    );
    for (const definition of [
      watchlist("MSFT", "AAPL"),
      watchlist("AAPL"),
      { kind: "default" } as const,
    ])
      expect(marketBoardCohortKey(definition, digest)).not.toBe(original);
    expect(
      marketBoardCohortKey(
        watchlist("AAPL", "MSFT"),
        `sha256:${"b".repeat(64)}`,
      ),
    ).not.toBe(original);
    expect(
      marketBoardCohortKey(
        {
          kind: "watchlist",
          members: [
            { ...member("AAPL"), issuerName: "Updated" },
            member("MSFT"),
          ],
        },
        digest,
      ),
    ).not.toBe(original);
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

function snapshotReceipt(): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: "2030-01-15T00:00:00.000Z",
    catalogId: "synthetic-browser-catalog",
    catalogVersion: "1.0.0",
    claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
    coverage: {
      activeEligibleSecurities: 3_001,
      activeListings: 3_001,
      admittedSourceRecords: 3_001,
      basis: "owner_declared_snapshot_only",
      eligibleSecurityBand: "at_least_3000",
      formerTickerEntries: 0,
      ineligibleSourceRecords: 10,
      inactiveSecurities: 0,
      issuers: 2_990,
      providerMappings: 6_002,
      quarantinedSourceRecords: 3,
      sourceRecords: 3_020,
      staleSourceRecords: 2,
      shareClasses: 3_001,
      totalSecurities: 3_001,
      unsupportedSourceRecords: 4,
    },
    generatedAt: "2030-01-14T23:30:00.000Z",
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2030-01-14T22:00:00.000Z",
      artifacts: [
        {
          acquiredAt: "2030-01-14T22:00:00.000Z",
          artifactId: "owner-source-a",
          contentSha256: `sha256:${"b".repeat(64)}`,
          mediaType: "application/json",
          sourceUri: "https://example.invalid/source.json",
          sourceVersion: "synthetic-browser-v1",
        },
      ],
      attribution: "Owner-local research sources.",
      contentKind: "owner_local_source",
      sourceId: "owner-security-source",
      sourceRevision: `sha256:${"c".repeat(64)}`,
    },
    schemaVersion: "1.0.0",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    sourcePolicyCompatibility: {
      attribution: "required",
      cache: "permitted_owner_local",
      decision: "compatible",
      deleteOnRequest: true,
      display: "permitted_owner_local",
      effectiveAt: "2029-01-01T00:00:00.000Z",
      expiresAt: "2031-01-01T00:00:00.000Z",
      export: "prohibited",
      intendedUse: "personal_security_research",
      localOnly: true,
      operation: "fetch_snapshot",
      policyDocumentSha256: `sha256:${"d".repeat(64)}`,
      policyId: "owner-security-policy",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2029-12-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "owner-security-source",
    },
    status: "admitted_for_personal_local_search",
  };
}
