import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortfolioCloseComposition } from "./PortfolioCloseComposition";
import { COMPANY_REPORT_HTML_STYLE } from "./company-report-html-style";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";
import { eodResponse } from "./eod-history-fixture";

function fixture(
  cashUsd: string | null = "1.00",
  close = "1",
  issuerName = "Zero Company",
) {
  const base = portfolioReviewReportFixture();
  const first = { ...base.ledger.identities[0]!, issuerName };
  const other = {
    ...first,
    listingId: "listing-class-c",
    securityId: "security-class-c",
    shareClassId: "class-c",
    shareClassName: "Class C",
    securityName: "Zero Class C",
    symbol: "ZEROC",
  };
  const identities = [first, other];
  const ledger = {
    ...base.ledger,
    identities,
    opening: {
      ...base.ledger.opening,
      cashUsd,
      holdings: identities.map((identity) => ({
        ...base.ledger.opening.holdings[0]!,
        listingId: identity.listingId,
        shares: "1",
      })),
    },
  };
  const packets = identities.map((security) => ({
    ...eodResponse(),
    security,
    rows: eodResponse().rows.map((row) => ({ ...row, close })),
  }));
  return portfolioReviewReportInput(ledger, "2026-09-19", packets);
}
function markup(input = fixture()) {
  return renderToStaticMarkup(
    <PortfolioCloseComposition
      id="portfolio-close-composition"
      review={input.review}
      rows={input.state.rows}
    />,
  );
}
function cellValues(html: string, attribute: string) {
  return [
    ...html.matchAll(new RegExp(`<td ${attribute}="true">([^<]*)</td>`, "gu")),
  ].map((match) => match[1]);
}

describe("shared read-only composition at one observed close", () => {
  it("keeps exact share classes, displayed cents, complete cash denominator and independent rounding", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const html = markup(input);
    expect(html).toContain('id="portfolio-close-composition"');
    expect(html).toContain(
      'data-method="displayed_usd_cents_over_complete_total_percent_half_up_2dp"',
    );
    expect(html).toContain("Composition at this close");
    expect(html).toContain("Share of complete value");
    expect(html).toContain('id="portfolio-close-composition-total">USD 3.00');
    expect(cellValues(html, "data-composition-value")).toEqual([
      "USD 1.00",
      "USD 1.00",
      "USD 1.00",
    ]);
    expect(cellValues(html, "data-composition-share")).toEqual([
      "33.33%",
      "33.33%",
      "33.33%",
    ]);
    expect(html).toContain('data-listing-id="listing-zero"');
    expect(html).toContain('data-listing-id="listing-class-c"');
    for (const listing of input.ledger.identities)
      for (const value of Object.values(listing)) expect(html).toContain(value);
    expect(html).toContain("Confirmed 2026-09-01");
    expect(html).toContain(
      "Raw closes on 2026-09-19; authored balances through 2026-09-01",
    );
    expect(html).toContain("rounds half-up to two decimal places");
    expect(html).toContain("may not add to 100%");
    expect(JSON.stringify(input)).toBe(before);
    expect(html).not.toMatch(/<button|<input|<select|<script|<a /iu);
  });
  it("shows unknown cash without turning priced holdings into 100 percent", () => {
    const html = markup(fixture(null));
    expect(html).toContain(
      "Composition is unavailable because authored cash is unknown.",
    );
    expect(cellValues(html, "data-composition-value")).toEqual([
      "USD 1.00",
      "USD 1.00",
      "Unknown",
    ]);
    expect(cellValues(html, "data-composition-share")).toEqual([
      "Unavailable",
      "Unavailable",
      "Unavailable",
    ]);
    expect(html).toContain(
      'id="portfolio-close-composition-total">Unavailable',
    );
  });
  it("retains partial values and known cash without normalizing the priced subset", () => {
    const f = fixture();
    const input = portfolioReviewReportInput(f.ledger, "2026-09-19", [
      f.state.rows[0]!.response!,
    ]);
    const html = markup(input);
    expect(html).toContain(
      "one or more holdings lack an eligible close for this exact date",
    );
    expect(cellValues(html, "data-composition-value")).toEqual([
      "USD 1.00",
      "Unavailable",
      "USD 1.00",
    ]);
    expect(cellValues(html, "data-composition-share")).toEqual([
      "Unavailable",
      "Unavailable",
      "Unavailable",
    ]);
    expect(html).toContain(
      "Partial holdings are not used as a smaller denominator.",
    );
  });
  it("labels later authored balances and confirmation dates while retaining their cash readout", () => {
    const f = fixture();
    const input = portfolioReviewReportInput(
      {
        ...f.ledger,
        opening: {
          ...f.ledger.opening,
          asOfDate: "2026-09-20",
          holdings: f.ledger.opening.holdings.map((row) => ({
            ...row,
            confirmedOn: "2026-09-20",
          })),
        },
      },
      "2026-09-19",
      f.state.rows.map((row) => row.response!),
    );
    const html = markup(input);
    expect(html).toContain(
      "authored balances or a holding confirmation are later than this close date",
    );
    expect(html).toContain("Confirmed 2026-09-20");
    expect(html).toContain(
      "Raw closes on 2026-09-19; authored balances through 2026-09-20",
    );
    expect(cellValues(html, "data-composition-value")).toEqual([
      "Unavailable",
      "Unavailable",
      "USD 1.00",
    ]);
    expect(cellValues(html, "data-composition-share")).toEqual([
      "Unavailable",
      "Unavailable",
      "Unavailable",
    ]);
  });
  it("keeps a complete zero-cent denominator explicit with unavailable shares", () => {
    const html = markup(fixture("0.00", "0.001"));
    expect(html).toContain("complete value is USD 0.00");
    expect(html).toContain('id="portfolio-close-composition-total">USD 0.00');
    expect(cellValues(html, "data-composition-value")).toEqual([
      "USD 0.00",
      "USD 0.00",
      "USD 0.00",
    ]);
    expect(cellValues(html, "data-composition-share")).toEqual([
      "Unavailable",
      "Unavailable",
      "Unavailable",
    ]);
  });
  it("wraps long values/identities and reuses the fixed offline table and focusable scroll region", () => {
    const longName =
      "Invented holding name Café 東京 with exact class identity "
        .repeat(3)
        .trim();
    const f = fixture("1000000000000.00", "1000000000.123456", longName);
    const html = markup(f);
    expect(html).toContain("1000000000.12");
    expect(html).toContain(longName);
    expect(html).toContain(
      'class="portfolio-composition-table managed-valuation-table" role="region"',
    );
    expect(html).toContain('tabindex="0"');
    expect(COMPANY_REPORT_HTML_STYLE).toContain(
      ".managed-valuation-table { max-width: 100%; overflow-x: auto;",
    );
    expect(COMPANY_REPORT_HTML_STYLE).toContain(
      "text-align: right; overflow-wrap: anywhere;",
    );
    expect(COMPANY_REPORT_HTML_STYLE).toContain("summary { min-height: 44px;");
    expect(COMPANY_REPORT_HTML_STYLE).toContain(
      "p, dd, li, pre { overflow-wrap: anywhere;",
    );
    const css = readFileSync(
      new URL("./portfolio-close-composition.css", import.meta.url),
      "utf8",
    );
    for (const rule of [
      "min-height: 44px",
      "overflow-wrap: anywhere",
      "table-layout: fixed",
      "max-width: 100%",
      ":focus-visible",
      "outline: 2px solid",
    ])
      expect(css).toContain(rule);
    expect(html).not.toContain("<style");
  });
});
