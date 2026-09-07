import type { PersonalMarketDataDailyBarDto } from "@research-cockpit/contracts";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PersonalMarketAnalytics } from "./PersonalMarketAnalytics";

describe("PersonalMarketAnalytics", () => {
  it("recomputes adjusted and raw aggregates from full provider bars", () => {
    const bars = directionalBars(205);
    const asOfDate = bars.at(-1)?.date ?? "2029-01-01";
    const adjusted = renderText(
      <PersonalMarketAnalytics
        asOfDate={asOfDate}
        bars={bars}
        mode="adjusted"
      />,
    );
    const raw = renderText(
      <PersonalMarketAnalytics asOfDate={asOfDate} bars={bars} mode="raw" />,
    );

    expect(adjusted).toContain("Adjusted · as of");
    expect(adjusted).toContain("+204.00%");
    expect(adjusted).toContain("Above");
    expect(adjusted).not.toContain("Warming up");
    expect(raw).toContain("Raw · as of");
    expect(raw).toContain("-51.00%");
    expect(raw).toContain("Below");
    expect(raw).toContain("Maximum drawdown 51.00%");
    expect(raw).not.toContain("Maximum drawdown +51.00%");
  });

  it("renders explicit warm-up and zero-range states", () => {
    const shortBars = directionalBars(2);
    const short = renderText(
      <PersonalMarketAnalytics
        asOfDate={shortBars.at(-1)?.date ?? "2029-01-01"}
        bars={shortBars}
        mode="adjusted"
      />,
    );
    expect(short).toContain("Warming up");
    expect(short).toContain("2 of 21 observed sessions");
    expect(short).toContain("2 of 20 observed sessions");
    expect(short).toContain("2 of 200 observed sessions");

    const flatBars = constantBars(200, "77");
    const flat = renderText(
      <PersonalMarketAnalytics
        asOfDate={flatBars.at(-1)?.date ?? "2029-01-01"}
        bars={flatBars}
        mode="adjusted"
      />,
    );
    expect(flat).toContain("Zero range");
    expect(flat).toContain(
      "Position is unavailable because the highest and lowest observed closes are equal",
    );
    expect(flat).toContain("At the trailing average (0.00%)");
  });

  it("does not display a tiny nonzero trend distance as exactly at or zero", () => {
    const bars = Array.from({ length: 20 }, (_, index) =>
      fullBar(dateAt(index), index === 19 ? "100.004" : "100", "1"),
    );
    const rendered = renderText(
      <PersonalMarketAnalytics
        asOfDate={bars.at(-1)?.date ?? "2029-01-20"}
        bars={bars}
        mode="adjusted"
      />,
    );

    expect(rendered).toContain("Above");
    expect(rendered).toContain("Less than 0.01% above the trailing average");
    expect(rendered).not.toContain("At the trailing average (0.00%)");
    expect(rendered).not.toContain("+0.00% from the trailing average");
  });

  it("discloses versioned formulas, metric samples, and the no-gap-fill policy", () => {
    const bars = directionalBars(205);
    const rendered = renderToStaticMarkup(
      <PersonalMarketAnalytics
        asOfDate={bars.at(-1)?.date ?? "2029-01-01"}
        bars={bars}
        mode="adjusted"
      />,
    );
    const text = visibleText(rendered);

    expect(rendered).toContain("aria-labelledby");
    expect(rendered).toContain("<details");
    expect(text).toContain(
      "Observed sessions only; missing dates are not gap-filled",
    );
    expect(text).toContain("latest 20 natural-log close returns");
    expect(text).toContain(
      "trailing_20_session_log_return_annualized_sample_volatility_percent",
    );
    expect(text).toContain("version 1.0.0");
    expect(text).toContain("rounding method: round_half_up");
    expect(text).toContain("205 observed sessions");
    expect(text).toContain("20 observed sessions");
    expect(text).toContain("do not generate an investment rating");
  });

  it("does not disclose source closes in its aggregate output", () => {
    const bars = [
      fullBar("2029-01-02", "987654.321", "123456.789"),
      fullBar("2029-01-03", "987655.321", "123455.789"),
    ];
    const rendered = renderToStaticMarkup(
      <PersonalMarketAnalytics
        asOfDate="2029-01-03"
        bars={bars}
        mode="adjusted"
      />,
    );

    expect(rendered).not.toContain("987654.321");
    expect(rendered).not.toContain("987655.321");
    expect(rendered).not.toContain("123456.789");
    expect(rendered).not.toContain("123455.789");
  });
});

function directionalBars(
  count: number,
): readonly PersonalMarketDataDailyBarDto[] {
  return Array.from({ length: count }, (_, index) =>
    fullBar(dateAt(index), String(100 + index), String(400 - index)),
  );
}

function constantBars(
  count: number,
  close: string,
): readonly PersonalMarketDataDailyBarDto[] {
  return Array.from({ length: count }, (_, index) =>
    fullBar(dateAt(index), close, close),
  );
}

function fullBar(
  date: string,
  adjustedClose: string,
  rawClose: string,
): PersonalMarketDataDailyBarDto {
  return {
    adjusted: ohlcv(adjustedClose),
    date,
    dividendCash: "0",
    raw: ohlcv(rawClose),
    splitFactor: "1",
  };
}

function ohlcv(close: string) {
  return {
    close,
    high: close,
    low: close,
    open: close,
    volume: "1000",
  };
}

function dateAt(index: number): string {
  return new Date(Date.UTC(2029, 0, index + 1)).toISOString().slice(0, 10);
}

function renderText(element: ReactNode): string {
  return visibleText(renderToStaticMarkup(element));
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replace(/\s+/gu, " ")
    .trim();
}
