import { load } from "cheerio";
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

function ruleBody(css: string, selector: string) {
  const normalized = css.replace(/\s+/gu, " ");
  const fragments = normalized.split(`${selector} {`);
  expect(fragments).toHaveLength(2);
  return fragments[1]!.split("}")[0]!;
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
    expect(html).toContain("Share (%)");
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
  it("keeps ticker, exact share class and company visible with all identity metadata in the disclosure", () => {
    const input = fixture();
    const $ = load(markup(input));
    for (const listing of input.ledger.identities) {
      const row = $("tr[data-listing-id]").filter(
        (_, element) =>
          $(element).attr("data-listing-id") === listing.listingId,
      );
      expect(row.find("summary strong").text().trim()).toBe(
        `${listing.symbol} · ${listing.shareClassName}`,
      );
      expect(row.find("summary .portfolio-composition-company").text()).toBe(
        listing.issuerName,
      );
      expect(row.find("summary").text()).not.toContain(listing.exchangeMic);
      expect(row.find("details li")).toHaveLength(11);
      for (const value of Object.values(listing))
        expect(row.find("details ul").text()).toContain(value);
    }
    const css = readFileSync(
      new URL("./portfolio-close-composition.css", import.meta.url),
      "utf8",
    );
    expect(
      ruleBody(
        css,
        ".portfolio-close-composition :is(small, .portfolio-composition-company)",
      ),
    ).toContain("display: block;");
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
  it("keeps concise column headings, row scopes and the complete cash-inclusive denominator", () => {
    const $ = load(markup());
    expect(
      $("thead th")
        .map((_, cell) => $(cell).text())
        .get(),
    ).toEqual(["Exact holding", "Value (USD)", "Share (%)"]);
    expect($("thead th[scope=col]")).toHaveLength(3);
    expect($("tbody th[scope=row]")).toHaveLength(3);
    expect($("tbody tr").last().is("[data-composition-cash]")).toBe(true);
    expect($("tbody tr").last().find("[data-composition-share]").text()).toBe(
      "33.33%",
    );
    expect($("dt").text()).toBe("Complete value including authored cash");
    expect($("p").text()).toContain(
      "divided by the complete value including authored cash",
    );
    expect($("[role=region]").attr("aria-label")).toBe(
      "Holding values and shares of complete value",
    );
  });
  it("overrides the actual shared minimum width and first-cell nowrap only for composition", () => {
    const common = readFileSync(
      new URL("./managed-valuation-workbench.css", import.meta.url),
      "utf8",
    );
    const local = readFileSync(
      new URL("./portfolio-close-composition.css", import.meta.url),
      "utf8",
    );
    const sharedCells = ".managed-frame .managed-valuation-table :is(th, td)";
    const scopedCells =
      ".managed-frame .managed-valuation-table.portfolio-composition-table :is(th, td)";
    const sharedFirst =
      ".managed-frame .managed-valuation-table th:first-child";
    const scopedFirst =
      ".managed-frame .managed-valuation-table.portfolio-composition-table th:first-child";
    expect(ruleBody(common, sharedCells)).toContain("min-width: 110px;");
    expect(ruleBody(common, sharedFirst)).toContain("white-space: nowrap;");
    expect(ruleBody(common, sharedFirst)).toContain("overflow-wrap: normal;");
    // The same selector plus one semantic class outranks the shared rule in either import order.
    expect(scopedCells.replace(".portfolio-composition-table", "")).toBe(
      sharedCells,
    );
    expect(scopedFirst.replace(".portfolio-composition-table", "")).toBe(
      sharedFirst,
    );
    for (const declaration of [
      "min-width: 0;",
      "white-space: normal;",
      "overflow-wrap: anywhere;",
      "word-break: normal;",
      "padding: 8px 6px;",
    ])
      expect(ruleBody(local, scopedCells)).toContain(declaration);
    for (const declaration of [
      "width: 46%;",
      "text-align: left;",
      "white-space: normal;",
      "overflow-wrap: anywhere;",
    ])
      expect(ruleBody(local, scopedFirst)).toContain(declaration);
    const $ = load(
      `<div class="managed-frame">${markup()}<div id="ordinary-valuation" class="managed-valuation-table"><table><tr><th>Existing valuation</th><td>42.00</td></tr></table></div></div>`,
    );
    expect($(sharedCells)).toHaveLength(14);
    expect($(scopedCells)).toHaveLength(12);
    expect($(scopedFirst)).toHaveLength(4);
    expect(
      $(scopedCells).filter(
        (_, cell) => $(cell).closest("#ordinary-valuation").length > 0,
      ),
    ).toHaveLength(0);
    expect(local).not.toMatch(
      /font-size\s*:|text-overflow\s*:|overflow(?:-x|-y)?\s*:\s*(?:hidden|clip)|white-space\s*:\s*nowrap/iu,
    );
  });
  it("retains every long identity and large numeric cell in both shared-component contexts", () => {
    const issuer = `Invented ${"UnbrokenIssuer".repeat(7)} Café 東京`;
    const input = fixture("1000000000000.00", "9".repeat(40), issuer);
    for (const id of [
      "portfolio-close-composition",
      "portfolio-report-composition",
    ] as const) {
      const $ = load(
        renderToStaticMarkup(
          <PortfolioCloseComposition
            id={id}
            review={input.review}
            rows={input.state.rows}
          />,
        ),
      );
      expect($("section").attr("id")).toBe(id);
      expect(
        $("tbody tr[data-listing-id]")
          .map((_, row) => $(row).attr("data-listing-id"))
          .get(),
      ).toEqual(input.ledger.identities.map((listing) => listing.listingId));
      for (const listing of input.ledger.identities) {
        const row = $("tbody tr").filter(
          (_, element) =>
            $(element).attr("data-listing-id") === listing.listingId,
        );
        expect(row.find("summary").text()).toBe(
          `${listing.symbol} · ${listing.shareClassName} ${listing.issuerName}`,
        );
        for (const value of Object.values(listing))
          expect(row.find("th").text()).toContain(value);
      }
      expect(
        $("[data-composition-value]")
          .map((_, cell) => $(cell).text())
          .get(),
      ).toEqual([
        ...input.review.composition.holdings.map(
          (row) => `USD ${row.valueUsd}`,
        ),
        `USD ${input.review.composition.cashUsd}`,
      ]);
      expect(
        $("[data-composition-share]")
          .map((_, cell) => $(cell).text())
          .get(),
      ).toEqual([
        ...input.review.composition.holdings.map((row) => `${row.percent}%`),
        `${input.review.composition.cashPercent}%`,
      ]);
      expect($("[hidden], [aria-hidden=true], [style]")).toHaveLength(0);
    }
  });
});
