import type { PersonalMarketOverviewDto } from "@research-cockpit/contracts";
import { calculatePersonalPortfolioOverview } from "@research-cockpit/personal-market-analytics";
import { describe, expect, it } from "vitest";

import {
  getPersonalMarketHistory,
  getPersonalMarketReference,
  personalMarketBatchStopCode,
  personalMarketFeedErrorCode,
} from "./personal-market-snapshot";

function snapshot(
  date = "2026-09-23",
  ingestedAt = "2026-09-24T07:00:00.000Z",
): PersonalMarketOverviewDto {
  const previous = new Date(`${date}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const window = {
    range: "1m" as const,
    startDate: previous.toISOString().slice(0, 10),
    endDate: date,
  };
  const bar = (barDate: string, price: string, splitFactor: string) => ({
    date: barDate,
    raw: { open: price, high: price, low: price, close: price, volume: "100" },
    adjusted: { open: "50", high: "50", low: "50", close: "50", volume: "200" },
    splitFactor,
    dividendCash: "0",
  });
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    security: {
      country: "US",
      listingId: "listing-a",
      symbol: "AAA",
      exchangeMic: "XNAS",
      issuerName: "Issuer A",
      securityName: "Common stock",
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
    ingestedAt,
    window,
    history: {
      status: "available",
      value: {
        ...window,
        currency: "USD",
        bars: [bar(window.startDate, "100", "1"), bar(date, "55", "2")],
      },
    },
    quote: { status: "not_requested" },
  };
}

describe("market snapshot consumers", () => {
  it("keeps history and an explicit EOD reference when the quote feed is denied", () => {
    const base = snapshot();
    const value = {
      ...base,
      quote: { status: "unavailable", reason: "access_denied" },
    } as const;
    expect(getPersonalMarketHistory(value)).toBe(
      base.history.status === "available" ? base.history.value : null,
    );
    const reference = getPersonalMarketReference(value);
    expect(reference).toMatchObject({
      sourceDate: "2026-09-23",
      timeBasis: "modeled_regular_close",
      quote: {
        kind: "end_of_day_close",
        price: "55",
        previousClose: "50",
        change: "5",
        changePercent: "10",
        currency: "USD",
        sourceTime: "2026-09-23T20:00:00.000Z",
      },
    });
    expect(personalMarketBatchStopCode(value)).toBe("access_denied");
    expect(Object.isFrozen(reference?.quote)).toBe(true);
  });

  it("uses an available IEX reference even when daily history failed", () => {
    const value: PersonalMarketOverviewDto = {
      ...snapshot(),
      history: { status: "unavailable", reason: "not_covered" },
      quote: {
        status: "available",
        value: {
          kind: "derived_realtime_reference",
          price: "120",
          previousClose: "100",
          change: "20",
          changePercent: "20",
          currency: "USD",
          freshness: "current",
          sourceTime: "2026-09-23T20:00:00.000Z",
          ingestedAt: "2026-09-24T07:00:00.000Z",
        },
      },
    };
    expect(getPersonalMarketHistory(value)).toBeNull();
    expect(getPersonalMarketReference(value)).toMatchObject({
      sourceDate: null,
      timeBasis: "provider_timestamp",
      quote: { price: "120", kind: "derived_realtime_reference" },
    });
    expect(personalMarketBatchStopCode(value)).toBeNull();
  });

  it("does not manufacture a reference when both sources are unavailable", () => {
    expect(
      getPersonalMarketReference({
        ...snapshot(),
        history: { status: "unavailable", reason: "not_covered" },
      }),
    ).toBeNull();
    expect(getPersonalMarketHistory(null)).toBeNull();
    expect(getPersonalMarketReference(null)).toBeNull();
  });

  it.each([
    ["2026-03-06", "2026-03-06T21:00:00.000Z"],
    ["2026-03-09", "2026-03-09T20:00:00.000Z"],
    ["2026-10-30", "2026-10-30T20:00:00.000Z"],
    ["2026-11-02", "2026-11-02T21:00:00.000Z"],
  ])(
    "preserves the existing regular-close age model for %s without calling it observed",
    (date, sourceTime) => {
      const reference = getPersonalMarketReference(
        snapshot(date, `${date}T23:00:00.000Z`),
      );
      expect(reference?.sourceDate).toBe(date);
      expect(reference?.timeBasis).toBe("modeled_regular_close");
      expect(reference?.quote.sourceTime).toBe(sourceTime);
    },
  );

  it("keeps the existing strict 36-hour age boundary", () => {
    expect(
      getPersonalMarketReference(
        snapshot("2026-09-23", "2026-09-25T08:00:00.000Z"),
      )?.quote.freshness,
    ).toBe("current");
    expect(
      getPersonalMarketReference(
        snapshot("2026-09-23", "2026-09-25T08:00:00.001Z"),
      )?.quote.freshness,
    ).toBe("older_than_36_hours");
    expect(
      getPersonalMarketReference(
        snapshot("2026-09-23", "2026-09-23T18:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it.each(["2", "3", `0.${"0".repeat(61)}1`])(
    "passes a bounded exact reference to portfolio valuation after split %s",
    (splitFactor) => {
      const base = snapshot();
      if (base.history.status !== "available")
        throw new Error("Expected history");
      const overview: PersonalMarketOverviewDto = {
        ...base,
        history: {
          status: "available",
          value: {
            ...base.history.value,
            bars: base.history.value.bars.map((bar, index) =>
              index === 1 ? { ...bar, splitFactor } : bar,
            ),
          },
        },
      };
      const reference = getPersonalMarketReference(overview);
      if (reference === null) throw new Error("Expected EOD reference");
      expect(Object.keys(reference.quote)).toHaveLength(9);
      const result = calculatePersonalPortfolioOverview({
        evaluatedAt: overview.ingestedAt,
        portfolio: {
          currency: "USD",
          cashUsd: "0",
          holdings: [
            {
              identity: overview.security,
              shares: "2",
              totalCostBasisUsd: "80",
              confirmedOn: "2026-09-01",
            },
          ],
        },
        quotes: [{ security: overview.security, quote: reference.quote }],
      });
      expect(result.holdings[0]?.priceStatus).toBe("priced");
      expect(result.holdings[0]?.marketValueUsd).toBe("110.00");
    },
  );

  it.each([
    ["credentials_invalid", "credentials_invalid"],
    ["access_denied", "access_denied"],
    ["rate_limited", "rate_limited"],
    ["upstream_unavailable", "provider_unavailable"],
    ["invalid_response", "invalid_response"],
    ["not_covered", "not_covered"],
  ] as const)(
    "maps %s without losing the safe failure reason",
    (reason, code) => {
      expect(personalMarketFeedErrorCode(reason)).toBe(code);
      const value = {
        ...snapshot(),
        quote: { status: "unavailable", reason },
      } as const;
      expect(personalMarketBatchStopCode(value)).toBe(
        ["credentials_invalid", "access_denied", "rate_limited"].includes(code)
          ? code
          : null,
      );
    },
  );
});
