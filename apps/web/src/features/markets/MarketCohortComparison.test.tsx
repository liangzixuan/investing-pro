import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import React, { type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MarketCohortComparison } from "./MarketCohortComparison";
import { deriveMarketCohortComparison } from "./market-cohort-comparison";
import {
  marketBoardCohortKey,
  type MarketBoardSnapshot,
} from "./market-board-loader";

const digest = `sha256:${"a".repeat(64)}`;

function listing(index: number): PersonalSecurityMasterScreenRowDto {
  const key = `member-${index}`;
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${key}`,
    issuerName: `Synthetic issuer ${index}`,
    listingId: `listing-${key}`,
    securityId: `security-${key}`,
    securityName: `Synthetic common stock ${index}`,
    shareClassId: `class-${key}`,
    shareClassName: "Common",
    symbol: ["ZZZ", "AAA", "SIX", "FOUR", "TWO", "LAST"][index] ?? "EXTRA",
  };
}

function snapshot(
  histories: readonly (readonly string[])[] = [
    ["100", "80", "110"],
    ["200", "180", "220"],
  ],
  members = histories.map((_, index) => listing(index)),
): MarketBoardSnapshot {
  const definition = {
    kind: "watchlist",
    members: members.map(({ cik, ...identity }) => {
      void cik;
      return identity;
    }),
  } as const;
  const window = {
    range: "1m",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  } as const;
  return {
    definition,
    cohortKey: marketBoardCohortKey(definition, digest),
    snapshotSha256: digest,
    loadedAt: "2026-10-01T12:00:00.000Z",
    stoppedBy: null,
    rows: members.map((identity, index) => ({
      symbol: identity.symbol,
      identity,
      error: null,
      overview: {
        schemaVersion: "2.0.0",
        profile: "personal_single_user_local_market_data",
        ingestedAt: "2026-10-01T11:00:00.000Z",
        security: {
          country: identity.country,
          exchangeMic: identity.exchangeMic,
          issuerName: identity.issuerName,
          listingId: identity.listingId,
          securityName: identity.securityName,
          symbol: identity.symbol,
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
            bars: (histories[index] ?? []).map((close, day) => ({
              date: `2026-09-${String(day + 1).padStart(2, "0")}`,
              raw: {
                open: close,
                high: close,
                low: close,
                close,
                volume: "10",
              },
              adjusted: {
                open: close,
                high: close,
                low: close,
                close,
                volume: "10",
              },
              splitFactor: "1",
              dividendCash: "0",
            })),
          },
        },
      },
    })),
  };
}

function withBars(
  input: MarketBoardSnapshot,
  index: number,
  change: (
    bars: Extract<
      PersonalMarketOverviewDto["history"],
      { status: "available" }
    >["value"]["bars"],
  ) => Extract<
    PersonalMarketOverviewDto["history"],
    { status: "available" }
  >["value"]["bars"],
): MarketBoardSnapshot {
  return {
    ...input,
    rows: input.rows.map((row, rowIndex) => {
      if (rowIndex !== index || row.overview?.history.status !== "available")
        return row;
      return {
        ...row,
        overview: {
          ...row.overview,
          history: {
            ...row.overview.history,
            value: {
              ...row.overview.history.value,
              bars: change(row.overview.history.value.bars),
            },
          },
        },
      };
    }),
  };
}

function render(
  input: MarketBoardSnapshot | null,
  cohortName = "My Watchlist selection",
) {
  return renderToStaticMarkup(
    <MarketCohortComparison
      model={deriveMarketCohortComparison(input)}
      cohortName={cohortName}
    />,
  );
}

function text(markup: string) {
  return markup
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function rows(markup: string) {
  const body = markup.match(/<tbody>([\s\S]*?)<\/tbody>/u)?.[1] ?? "";
  return Array.from(body.matchAll(/<tr>([\s\S]*?)<\/tr>/gu), (match) =>
    text(match[1] ?? ""),
  );
}

function nodes(
  node: ReactNode,
): ReactElement<{ children?: ReactNode; [key: string]: unknown }>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (
    !React.isValidElement<{ children?: ReactNode; [key: string]: unknown }>(
      node,
    )
  )
    return [];
  return [node, ...nodes(node.props.children)];
}

describe("Markets cohort comparison presentation", () => {
  it("renders nothing before a matching snapshot is loaded", () => {
    expect(render(null)).toBe("");
  });

  it("explains a single-member board without a numeric or empty table", () => {
    const html = render(snapshot([["100", "110"]]));
    expect(text(html)).toContain("Choose and load at least two listings");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<details");
  });

  it("withholds every metric when one member failed instead of comparing the successful subset", () => {
    const input = snapshot();
    const html = render({
      ...input,
      rows: input.rows.map((row, index) =>
        index === 1 ? { ...row, overview: null, error: "not_covered" } : row,
      ),
    });
    expect(text(html)).toContain(
      "Every listing in this board needs a successful, matching price history",
    );
    expect(text(html)).toContain("No subset was compared");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("10.0000%");
  });

  it("reports an identity mismatch as unverifiable instead of missing or zero performance", () => {
    const input = snapshot();
    const html = render({ ...input, cohortKey: "mismatched-cohort" });
    expect(text(html)).toContain("could not be verified");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("0.0000%");
  });

  it("preserves six-member cohort order and names its scope instead of sorting by return", () => {
    const input = snapshot(
      Array.from({ length: 6 }, (_, index) => ["100", String(120 - index)]),
    );
    const html = render(input);
    expect(rows(html).map((row) => row.split(" ")[0])).toEqual([
      "ZZZ",
      "AAA",
      "SIX",
      "FOUR",
      "TWO",
      "LAST",
    ]);
    expect(text(html)).toContain("My Watchlist selection");
    expect(text(html)).toContain(
      "All 6 loaded listings in original cohort order",
    );
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<canvas");
  });

  it("distinguishes the same symbol on two venues", () => {
    const first = listing(0);
    const second = { ...listing(1), symbol: first.symbol, exchangeMic: "XNYS" };
    const html = render(
      snapshot(
        [
          ["100", "90"],
          ["100", "110"],
        ],
        [first, second],
      ),
    );
    expect(rows(html)[0]).toContain("ZZZ XNAS");
    expect(rows(html)[1]).toContain("ZZZ XNYS");
  });

  it("shows actual shared dates and four-place results separately from requested and retrieval dates", () => {
    const html = render(snapshot());
    expect(text(html)).toContain(
      "Shared window: 2026-09-01 to 2026-09-03 · 3 shared observations",
    );
    expect(rows(html)[0]).toContain("10.0000% 20.0000%");
    expect(rows(html)[1]).toContain("10.0000% 10.0000%");
    expect(text(html)).toContain("Requested bounds 2026-09-01 to 2026-09-30");
    expect(html).not.toContain("2026-10-01");
    expect(text(html)).toContain(
      "No additional data is loaded for this comparison",
    );
  });

  it("retains exact decimal closes and a positive decline that rounds to zero", () => {
    const html = render(
      snapshot([
        ["100", "99.999999"],
        ["100", "100"],
      ]),
    );
    expect(rows(html)[0]).toContain(
      "0.0000% Positive decline rounded to four decimals",
    );
    expect(rows(html)[1]).toContain(
      "0.0000% No decline observed on shared dates",
    );
    expect(text(html)).toContain(
      "First / last shared adjusted close (USD) 100 / 99.999999",
    );
    expect(text(html)).toContain(
      "Drawdown peak / trough 2026-09-01 / 2026-09-02",
    );
  });

  it("preserves large exact close strings in the disclosure without Number conversion", () => {
    const html = render(
      snapshot([
        ["99999999999999", "99999999999999.0001"],
        ["1", "1"],
      ]),
    );
    expect(text(html)).toContain("99999999999999 / 99999999999999.0001");
    expect(rows(html)).toHaveLength(2);
  });

  it("discloses omitted observations and the decline they can hide", () => {
    const input = withBars(
      snapshot([
        ["100", "50", "110"],
        ["100", "90", "110"],
      ]),
      1,
      (bars) => bars.filter((_, index) => index !== 1),
    );
    const html = render(input);
    expect(text(html)).toContain("2 shared observations");
    expect(rows(html)[0]).toContain("No decline observed on shared dates");
    expect(text(html)).toContain("Observed bars 3");
    expect(text(html)).toContain("Omitted dates 1");
    expect(text(html)).toContain(
      "Omitted or missing observations can hide intervening declines",
    );
    expect(text(html)).toContain("Missing dates are not filled");
    expect(text(html)).toContain("not guarantee a full month");
    expect(text(html)).toContain(
      "not an independently reconstructed total return",
    );
  });

  it.each([0, 1])(
    "keeps coverage but no numeric comparison with %s shared dates",
    (count) => {
      const input = withBars(
        snapshot([
          ["100", "80"],
          ["100", "90", "110", "120"],
        ]),
        1,
        (bars) => bars.slice(2 - count),
      );
      const html = render(input);
      expect(text(html)).toContain(`${count} shared observations loaded`);
      if (count === 1) expect(text(html)).toContain("Shared date: 2026-09-02");
      expect(html).not.toContain("<table");
      expect(html).not.toContain("20.0000%");
      expect(html).toContain("<details");
      expect(text(html)).toContain("Observed bars");
      expect(text(html)).not.toContain("First / last shared adjusted close");
    },
  );

  it("uses scoped table headers and an unmodified native keyboard disclosure", () => {
    const input = snapshot();
    const view = MarketCohortComparison({
      model: deriveMarketCohortComparison(input),
      cohortName: "Default suggestions",
    });
    const html = renderToStaticMarkup(view);
    expect(html).toContain('aria-labelledby="markets-cohort-comparison-title"');
    expect(html.match(/<th scope="col">/gu)).toHaveLength(3);
    expect(html.match(/<th scope="row">/gu)).toHaveLength(2);
    expect(html).toContain("<caption>");
    expect(html).toContain(
      '<details class="markets-cohort-details"><summary>History coverage and calculation details</summary>',
    );
    const details = nodes(view).find((node) => node.type === "details");
    const summary = nodes(view).find((node) => node.type === "summary");
    expect(details?.props.open).toBeUndefined();
    expect(summary?.props.onKeyDown).toBeUndefined();
    expect(summary?.props.role).toBeUndefined();
    expect(summary?.props.tabIndex).toBeUndefined();
  });

  it("performs no fetch while deriving or rendering a complete comparison", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    try {
      expect(rows(render(snapshot()))).toHaveLength(2);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
