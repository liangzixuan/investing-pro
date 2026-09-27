import type {
  PersonalMarketDataDailyBarDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  marketBoardCohortKey,
  type MarketBoardDefinition,
  type MarketBoardEntry,
  type MarketBoardMember,
  type MarketBoardSnapshot,
} from "./market-board-loader";
import { deriveMarketCohortComparison } from "./market-cohort-comparison";

const digest = `sha256:${"a".repeat(64)}`;
const window = {
  range: "1m",
  startDate: "2026-09-01",
  endDate: "2026-09-24",
} as const;

function identity(symbol: string): MarketBoardMember {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol.toLowerCase()}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol.toLowerCase()}`,
    securityId: `security-${symbol.toLowerCase()}`,
    securityName: `${symbol} common stock`,
    shareClassId: `class-${symbol.toLowerCase()}`,
    shareClassName: "Common",
    symbol,
  };
}

function bar(
  day: number,
  close = "100",
  rawClose = close,
): PersonalMarketDataDailyBarDto {
  return {
    date: `2026-09-${String(day).padStart(2, "0")}`,
    adjusted: { open: close, high: close, low: close, close, volume: "100" },
    raw: {
      open: rawClose,
      high: rawClose,
      low: rawClose,
      close: rawClose,
      volume: "100",
    },
    splitFactor: "1",
    dividendCash: "0",
  };
}

function overview(member: MarketBoardMember): PersonalMarketOverviewDto {
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    ingestedAt: "2026-09-24T23:00:00.000Z",
    security: {
      country: member.country,
      exchangeMic: member.exchangeMic,
      issuerName: member.issuerName,
      listingId: member.listingId,
      securityName: member.securityName,
      symbol: member.symbol,
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
      value: {
        ...window,
        currency: "USD",
        bars: [bar(2), bar(3, "80"), bar(5, "120")],
      },
    },
  };
}

function snapshot(
  symbols = ["MSFT", "AAPL"],
  kind: "default" | "watchlist" = "watchlist",
): MarketBoardSnapshot {
  const members = symbols.map(identity);
  const definition: MarketBoardDefinition =
    kind === "default" ? { kind } : { kind, members };
  return {
    definition,
    cohortKey: marketBoardCohortKey(definition, digest),
    snapshotSha256: digest,
    loadedAt: "2026-09-24T23:00:00.000Z",
    stoppedBy: null,
    rows: members.map((member) => ({
      symbol: member.symbol,
      identity: { ...member, cik: "0000000001" },
      overview: overview(member),
      error: null,
    })),
  };
}

function changeRow(
  value: MarketBoardSnapshot,
  index: number,
  patch: Partial<MarketBoardEntry>,
): MarketBoardSnapshot {
  return {
    ...value,
    rows: value.rows.map((row, position) =>
      position === index ? { ...row, ...patch } : row,
    ),
  };
}

function changeOverview(
  value: MarketBoardSnapshot,
  patch: Partial<PersonalMarketOverviewDto>,
  index = 0,
): MarketBoardSnapshot {
  const current = value.rows[index]?.overview;
  if (!current) throw new TypeError();
  return changeRow(value, index, { overview: { ...current, ...patch } });
}

function withBars(
  value: MarketBoardSnapshot,
  index: number,
  bars: readonly PersonalMarketDataDailyBarDto[],
): MarketBoardSnapshot {
  return changeOverview(
    value,
    {
      history: {
        status: "available",
        value: { ...window, currency: "USD", bars },
      },
    },
    index,
  );
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

afterEach(() => vi.unstubAllGlobals());

describe("loaded Markets cohort comparison", () => {
  it("has no model before a snapshot is admitted", () => {
    expect(deriveMarketCohortComparison(null)).toBeNull();
  });

  it("preserves original cohort order and the existing adjusted-price metrics", () => {
    const result = deriveMarketCohortComparison(snapshot());
    expect(result?.status).toBe("available");
    if (result?.status !== "available") throw new TypeError();
    expect(result.members.map((member) => member.symbol)).toEqual([
      "MSFT",
      "AAPL",
    ]);
    expect(result.comparison.rows.map((row) => row.listingId)).toEqual([
      "listing-msft",
      "listing-aapl",
    ]);
    expect(result.comparison).toMatchObject({
      firstDate: "2026-09-02",
      lastDate: "2026-09-05",
      sharedSessionCount: 3,
    });
    expect(result.comparison.rows[0]).toMatchObject({
      selectedWindowReturn: {
        valuePercent: "20.0000",
        formulaVersion: "1.0.0",
      },
      maximumDrawdown: {
        valuePercent: "20.0000",
        peakDate: "2026-09-02",
        troughDate: "2026-09-03",
      },
    });
  });

  it("compares all six members rather than truncating to an old three-series limit", () => {
    const result = deriveMarketCohortComparison(
      snapshot(["WMT", "AAPL", "MSFT", "COST", "KO", "CAT"]),
    );
    expect(result?.status).toBe("available");
    if (result?.status !== "available") throw new TypeError();
    expect(result.members.map((member) => member.symbol)).toEqual([
      "WMT",
      "AAPL",
      "MSFT",
      "COST",
      "KO",
      "CAT",
    ]);
    expect(result.comparison.rows).toHaveLength(6);
  });

  it("accepts only the complete default rows in their declared order", () => {
    const value = snapshot(["AAPL", "MSFT", "WMT"], "default");
    expect(deriveMarketCohortComparison(value)?.status).toBe("available");
    expect(
      deriveMarketCohortComparison({
        ...value,
        rows: [...value.rows].reverse(),
      }),
    ).toEqual({ status: "unavailable", reason: "invalid_snapshot" });
    expect(
      deriveMarketCohortComparison(snapshot(["AAPL", "MSFT", "KO"], "default")),
    ).toEqual({ status: "unavailable", reason: "invalid_snapshot" });
  });

  it("reports one valid member without inventing a second comparison series", () => {
    expect(deriveMarketCohortComparison(snapshot(["AAPL"]))).toEqual({
      status: "unavailable",
      reason: "single_member",
    });
  });

  it("refuses empty or oversized definitions", () => {
    for (const symbols of [
      [],
      ["AAPL", "MSFT", "WMT", "KO", "CAT", "COST", "IBM"],
    ]) {
      expect(deriveMarketCohortComparison(snapshot(symbols))).toEqual({
        status: "unavailable",
        reason: "invalid_snapshot",
      });
    }
  });

  it("does not silently drop absent, failed, unsupported or unrequested members", () => {
    const value = snapshot(["AAPL", "MSFT", "WMT"]);
    const partials = [
      { ...value, rows: value.rows.slice(0, 2) },
      changeRow(value, 2, {
        identity: null,
        overview: null,
        error: "unsupported_listing",
      }),
      changeRow(value, 2, { overview: null, error: "not_requested" }),
      changeRow(value, 2, { overview: null, error: "provider_unavailable" }),
      changeOverview(
        value,
        { history: { status: "unavailable", reason: "not_covered" } },
        2,
      ),
    ];
    for (const partial of partials) {
      expect(deriveMarketCohortComparison(partial)).toEqual({
        status: "unavailable",
        reason: "incomplete_cohort",
      });
    }
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "issuer-replacement"],
    ["issuerName", "Replacement issuer"],
    ["listingId", "listing-replacement"],
    ["securityId", "security-replacement"],
    ["securityName", "Replacement security"],
    ["shareClassId", "class-replacement"],
    ["shareClassName", "Replacement class"],
    ["symbol", "OTHER"],
  ])(
    "requires the captured watchlist %s identity field",
    (key, replacement) => {
      const value = snapshot();
      const changed = {
        ...value.rows[0]!.identity,
        [key]: replacement,
      } as PersonalSecurityMasterScreenRowDto;
      expect(
        deriveMarketCohortComparison(
          changeRow(value, 0, { identity: changed }),
        ),
      ).toEqual({ status: "unavailable", reason: "invalid_snapshot" });
    },
  );

  it("rejects duplicate listings and duplicate symbol/venue identities", () => {
    expect(deriveMarketCohortComparison(snapshot(["AAPL", "AAPL"]))).toEqual({
      status: "unavailable",
      reason: "invalid_snapshot",
    });
    const value = snapshot(["AAPL", "MSFT"]);
    const members = [
      identity("AAPL"),
      { ...identity("AAPL"), listingId: "listing-second" },
    ];
    const definition = { kind: "watchlist", members } as const;
    const duplicateVenue = {
      ...value,
      definition,
      cohortKey: marketBoardCohortKey(definition, digest),
      rows: members.map((member) => ({
        symbol: member.symbol,
        identity: { ...member, cik: "0000000001" },
        overview: overview(member),
        error: null,
      })),
    };
    expect(deriveMarketCohortComparison(duplicateVenue)).toEqual({
      status: "unavailable",
      reason: "invalid_snapshot",
    });
  });

  it("rejects catalog/cohort mismatches and rows outside the declared cohort", () => {
    const value = snapshot();
    for (const changed of [
      { ...value, cohortKey: "other" },
      { ...value, snapshotSha256: `sha256:${"b".repeat(64)}` },
    ]) {
      expect(deriveMarketCohortComparison(changed)).toEqual({
        status: "unavailable",
        reason: "invalid_snapshot",
      });
    }
    expect(
      deriveMarketCohortComparison({
        ...value,
        rows: [...value.rows, value.rows[0]!],
      }),
    ).toEqual({ status: "unavailable", reason: "incomplete_cohort" });
  });

  it("requires each overview identity, window and history to match the admitted row", () => {
    const value = snapshot();
    const original = value.rows[0]!.overview!;
    const history = original.history;
    if (history.status !== "available") throw new TypeError();
    const mismatches = [
      changeOverview(value, {
        security: { ...original.security, listingId: "listing-other" },
      }),
      changeOverview(value, { window: { ...window, range: "3m" } }),
      changeOverview(value, {
        history: {
          status: "available",
          value: { ...history.value, startDate: "2026-09-02" },
        },
      }),
      changeOverview(value, {
        history: {
          status: "available",
          value: { ...history.value, endDate: "2026-09-23" },
        },
      }),
      changeOverview(value, {
        quote: { status: "unavailable", reason: "access_denied" },
      }),
    ];
    for (const changed of mismatches)
      expect(deriveMarketCohortComparison(changed)).toEqual({
        status: "unavailable",
        reason: "invalid_snapshot",
      });
  });

  it("preserves requested and observed coverage for shifted histories", () => {
    let value = withBars(snapshot(), 0, [
      bar(1, "10"),
      bar(2, "100", "5"),
      bar(5, "120", "1"),
      bar(8, "500"),
    ]);
    value = withBars(value, 1, [bar(2, "200"), bar(3, "50"), bar(5, "180")]);
    const result = deriveMarketCohortComparison(value);
    if (result?.status !== "available") throw new TypeError();
    expect(result.comparison.sharedDates).toEqual(["2026-09-02", "2026-09-05"]);
    expect(result.comparison.rows[0]).toMatchObject({
      startDate: window.startDate,
      endDate: window.endDate,
      observedFirstDate: "2026-09-01",
      observedLastDate: "2026-09-08",
      loadedSessionCount: 4,
      excludedSessionCount: 2,
      firstAdjustedClose: "100",
      lastAdjustedClose: "120",
      selectedWindowReturn: { valuePercent: "20.0000" },
    });
  });

  it.each([0, 1])(
    "exposes insufficient history for %i shared observations",
    (count) => {
      const value = withBars(snapshot(), 1, count === 0 ? [] : [bar(3)]);
      const result = deriveMarketCohortComparison(value);
      expect(result?.status).toBe("insufficient_history");
      if (result?.status !== "insufficient_history") throw new TypeError();
      expect(result.comparison.sharedSessionCount).toBe(count);
      expect(result.comparison.rows).toHaveLength(2);
      expect(
        result.comparison.rows.every((row) => !("selectedWindowReturn" in row)),
      ).toBe(true);
    },
  );

  it("does not hide an invalid bar when its date would be excluded from alignment", () => {
    const value = withBars(snapshot(), 0, [
      bar(1, "0"),
      bar(2),
      bar(3),
      bar(5),
    ]);
    expect(deriveMarketCohortComparison(value)).toEqual({
      status: "unavailable",
      reason: "invalid_snapshot",
    });
  });

  it("delegates impossible, unordered and out-of-window dates to engine validation", () => {
    const originals = [bar(2), bar(3)];
    const invalid = [
      [{ ...bar(2), date: "2026-09-31" }, bar(3)],
      [...originals].reverse(),
      [bar(25), bar(26)],
    ];
    for (const bars of invalid)
      expect(
        deriveMarketCohortComparison(withBars(snapshot(), 0, bars)),
      ).toEqual({ status: "unavailable", reason: "invalid_snapshot" });
  });

  it("derives only the supplied snapshot with no IO, mutation or retained-row mixing", () => {
    const fetch = vi.fn(() => {
      throw new Error("Unexpected IO");
    });
    vi.stubGlobal("fetch", fetch);
    const value = freezeDeep(snapshot());
    const before = JSON.stringify(value);
    const result = deriveMarketCohortComparison(value);
    expect(result?.status).toBe("available");
    expect(
      deriveMarketCohortComparison(
        changeRow(value, 1, { overview: null, error: "provider_unavailable" }),
      ),
    ).toEqual({ status: "unavailable", reason: "incomplete_cohort" });
    expect(deriveMarketCohortComparison(value)).toEqual(result);
    expect(JSON.stringify(value)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    if (result?.status !== "available") throw new TypeError();
    expect(Object.isFrozen(result.members)).toBe(true);
    expect(Object.isFrozen(result.members[0])).toBe(true);
    expect(Object.isFrozen(result.comparison.rows)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
