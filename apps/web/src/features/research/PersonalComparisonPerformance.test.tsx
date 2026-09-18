import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import type { PersonalPricePerformanceComparisonSeries } from "@research-cockpit/personal-market-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PersonalComparisonPerformance,
  type PersonalComparisonPerformanceProps,
} from "./PersonalComparisonPerformance";

describe("PersonalComparisonPerformance", () => {
  it.each(["100000000000000", "0.000000001"])(
    "keeps comparison metrics and exact-data access when %s cannot be plotted",
    (close) => {
      const markup = render([
        history("aaa", ["1", close]),
        history("bbb", ["2", "2"]),
      ]);
      expect(visibleText(markup)).toContain("Chart unavailable");
      expect(visibleText(markup)).toContain(
        "Inspect exact adjusted closes and index values (2 observations)",
      );
      expect(performanceRows(markup)).toHaveLength(2);
      expect(visibleText(markup)).toContain(
        "Maximum drawdown on shared observations",
      );
      expect(visibleText(performanceRows(markup)[0]?.[2] ?? "")).toBe("1");
      expect(visibleText(performanceRows(markup)[0]?.[3] ?? "")).toBe(close);
    },
  );

  it("shows a positive peak-to-trough loss even when the shared window recovers", () => {
    const markup = render([
      history("aaa", ["100", "80", "110"]),
      history("bbb", ["200", "180", "220"]),
    ]);
    const rows = performanceRows(markup);

    expect(visibleText(rows[0]?.[0] ?? "")).toBe("10.0000%");
    expect(visibleText(rows[1]?.[0] ?? "")).toBe("10.0000%");
    expect(drawdownText(rows, 0)).toBe(
      "20.0000% Peak 2026-09-01 Trough 2026-09-02",
    );
    expect(drawdownText(rows, 1)).toBe(
      "10.0000% Peak 2026-09-01 Trough 2026-09-02",
    );
    expect(drawdownText(rows, 0)).not.toMatch(/[+-]20\.0000%/u);
    expect(visibleText(rows[0]?.[2] ?? "")).toBe("100");
    expect(visibleText(rows[0]?.[3] ?? "")).toBe("110");
    expect(visibleText(markup)).toContain(
      "Shared window: 2026-09-01 to 2026-09-03 · 3 shared observations.",
    );
  });

  it.each([
    ["rising", ["100", "110", "120"]],
    ["flat", ["100", "100", "100"]],
  ] as const)(
    "reports no observed decline for %s prices without inventing episode dates",
    (_, closes) => {
      const rows = performanceRows(
        render([history("aaa", closes), history("bbb", closes)]),
      );

      for (let index = 0; index < rows.length; index += 1) {
        expect(drawdownText(rows, index)).toBe(
          "0.0000% — no decline observed on shared dates",
        );
        expect(rows[index]?.[1]).not.toContain("<time");
        expect(rows[index]?.[1]).not.toContain("<dt>Peak</dt>");
        expect(rows[index]?.[1]).not.toContain("<dt>Trough</dt>");
      }
    },
  );

  it("keeps the episode dates for a positive decline rounded to zero", () => {
    const rows = performanceRows(
      render([
        history("aaa", ["100", "99.999999"]),
        history("bbb", ["100", "100"]),
      ]),
    );

    expect(drawdownText(rows, 0)).toBe(
      "0.0000% — positive decline rounded to four decimals Peak 2026-09-01 Trough 2026-09-02",
    );
    expect(rows[0]?.[1]).toContain(
      '<time dateTime="2026-09-01">2026-09-01</time>',
    );
    expect(rows[0]?.[1]).toContain(
      '<time dateTime="2026-09-02">2026-09-02</time>',
    );
    expect(drawdownText(rows, 1)).toBe(
      "0.0000% — no decline observed on shared dates",
    );
  });

  it("retains the earliest peak and trough when equal declines recur", () => {
    const rows = performanceRows(
      render([
        history("aaa", ["100", "100", "80", "100", "80"]),
        history("bbb", ["50", "50", "40", "50", "40"]),
      ]),
    );

    expect(drawdownText(rows, 0)).toBe(
      "20.0000% Peak 2026-09-01 Trough 2026-09-03",
    );
    expect(drawdownText(rows, 1)).toBe(
      "20.0000% Peak 2026-09-01 Trough 2026-09-03",
    );
    expect(rows[0]?.[1]).not.toContain("2026-09-05");
  });

  it("uses the common observations across all three members and discloses hidden declines", () => {
    const sparse = history("ccc", ["50", "51", "52"]);
    const markup = render([
      history("aaa", ["100", "50", "110"]),
      history("bbb", ["200", "100", "220"]),
      { ...sparse, bars: sparse.bars.filter((_, index) => index !== 1) },
    ]);
    const rows = performanceRows(markup);

    expect(rows).toHaveLength(3);
    expect(visibleText(markup)).toContain("2 shared observations.");
    expect(drawdownText(rows, 0)).toBe(
      "0.0000% — no decline observed on shared dates",
    );
    expect(drawdownText(rows, 1)).toBe(
      "0.0000% — no decline observed on shared dates",
    );
    expect(rows.map((cells) => visibleText(cells.at(-1) ?? ""))).toEqual([
      "1",
      "1",
      "0",
    ]);
    expect(visibleText(rows[0]?.[4] ?? "")).toContain("Observed bars 3");
    expect(visibleText(rows[2]?.[4] ?? "")).toContain("Observed bars 2");
    expect(visibleText(markup)).toContain(
      "Omitted or missing observations can hide intervening declines.",
    );
    expect(visibleText(markup)).toContain(
      "This is not a full daily-history drawdown or a risk score.",
    );
  });

  it.each([
    ["idle", "Performance not loaded."],
    ["loading", "Waiting for every selected company's history"],
    ["incomplete", "No subset was compared."],
  ] as const)("withholds all metrics while %s", (state, message) => {
    const markup = render(
      [history("aaa", ["100", "80"]), history("bbb", ["100", "80"])],
      state,
    );

    expect(visibleText(markup)).toContain(message);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("<table");
    expect(markup).not.toContain(
      'aria-label="Indexed adjusted-price comparison"',
    );
    expect(markup).not.toContain("20.0000%");
    expect(markup).not.toContain('class="comparison-performance-drawdown"');
  });

  it.each([0, 1])(
    "keeps coverage without return or drawdown for %s shared observations",
    (sharedCount) => {
      const second = history("bbb", ["50", "40", "45", "55"]);
      const markup = render([
        history("aaa", ["100", "80"]),
        { ...second, bars: second.bars.slice(2 - sharedCount) },
      ]);

      expect(visibleText(markup)).toContain(
        `${sharedCount} shared observations loaded.`,
      );
      expect(markup).toContain("<table");
      expect(visibleText(markup)).toContain("Loaded history coverage;");
      expect(visibleText(markup)).toContain("Omitted dates");
      expect(markup).not.toContain(
        '<th scope="col">Maximum drawdown on shared observations</th>',
      );
      expect(markup).not.toContain("20.0000%");
      expect(performanceRows(markup).every((cells) => cells.length === 2)).toBe(
        true,
      );
    },
  );

  it("fails closed when a history contains an invalid omitted bar", () => {
    const first = history("aaa", ["100", "-1", "110"]);
    const second = history("bbb", ["100", "100", "110"]);
    const markup = render([
      first,
      { ...second, bars: second.bars.filter((_, index) => index !== 1) },
    ]);

    expect(visibleText(markup)).toContain(
      "Performance unavailable: the loaded histories could not be compared.",
    );
    expect(markup).not.toContain("<table");
    expect(markup).not.toContain('class="comparison-performance-drawdown"');
  });

  it("preserves a labelled, keyboard-accessible table with scoped headers and history context", () => {
    const markup = render([
      history("aaa", ["100", "80"]),
      history("bbb", ["200", "180"]),
    ]);
    const text = visibleText(markup);

    expect(markup).toContain(
      'role="region" aria-label="Adjusted-price performance and history coverage" tabindex="0"',
    );
    expect(markup).toContain(
      '<th scope="col">Maximum drawdown on shared observations</th>',
    );
    expect(markup.match(/<th scope="col">/gu)).toHaveLength(7);
    expect(markup).toContain('<th scope="row">AAA · XNAS</th>');
    expect(markup).toContain('<th scope="row">BBB · XNAS</th>');
    expect(markup).toContain(
      "<caption>Adjusted-price change and maximum drawdown on shared observations; adjusted closes in USD and loaded history coverage.</caption>",
    );
    expect(text).toContain("Requested bounds 2026-09-01 to 2026-09-30");
    expect(text).toContain("Latest history bar 2026-09-02");
    expect(text).toContain("missing dates are not filled");
    expect(text).toContain(
      "A requested range does not guarantee full coverage.",
    );
    expect(text).toContain("Reference quotes above are not used");
    expect(text).toContain("not an independently reconstructed total return");
  });
});

function render(
  series: readonly PersonalPricePerformanceComparisonSeries[],
  state: PersonalComparisonPerformanceProps["state"] = "ready",
): string {
  return renderToStaticMarkup(
    <PersonalComparisonPerformance
      listings={series.map((entry) => listing(entry.listingId))}
      series={series}
      state={state}
    />,
  );
}

function history(
  symbol: string,
  closes: readonly string[],
): PersonalPricePerformanceComparisonSeries {
  return {
    listingId: `lst-${symbol}`,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    bars: closes.map((close, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, "0")}`,
      adjusted: { close },
      raw: { close: String(1_000 - index) },
    })),
  };
}

function listing(listingId: string): PersonalSecurityMasterScreenRowDto {
  const symbol = listingId.slice(4).toUpperCase();
  return {
    country: "US",
    cik: "0000000001",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `iss-${symbol.toLowerCase()}`,
    issuerName: `${symbol} Company`,
    listingId,
    securityId: `sec-${symbol.toLowerCase()}`,
    securityName: `${symbol} Common Stock`,
    shareClassId: `shr-${symbol.toLowerCase()}`,
    shareClassName: "Common",
    symbol,
  };
}

function performanceRows(markup: string): string[][] {
  const body = markup.match(/<tbody>([\s\S]*?)<\/tbody>/u)?.[1] ?? "";
  return Array.from(body.matchAll(/<tr>([\s\S]*?)<\/tr>/gu), (row) =>
    Array.from(
      row[1]?.matchAll(/<td(?: [^>]*)?>([\s\S]*?)<\/td>/gu) ?? [],
      (cell) => cell[1] ?? "",
    ),
  );
}

function drawdownText(rows: readonly string[][], index: number): string {
  return visibleText(rows[index]?.[1] ?? "");
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}
