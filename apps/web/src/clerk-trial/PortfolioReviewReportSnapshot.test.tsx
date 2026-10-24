import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";

describe("read-only captured Portfolio report", () => {
  it("contains full ledger and raw source appendix, every identity field, unknowns and original clocks", () => {
    const f = portfolioReviewReportFixture();
    const input = portfolioReviewReportInput({
      ...f.ledger,
      opening: { ...f.ledger.opening, cashUsd: null },
    });
    const report = preparePortfolioReviewReport(input)!;
    const markup = renderToStaticMarkup(
      <PortfolioReviewReportSnapshot report={report} />,
    );
    for (const text of [
      "Portfolio holdings review",
      "USD 203.00",
      "Unknown",
      "Unavailable",
      "2026-09-20T00:00:01.000Z",
      "2026-10-24T03:00:00.123Z",
      "Complete authored ledger",
      "Complete report document and source packets",
      "schemaVersion",
      "transactions",
      "raw_close",
      "101.5",
      "each_holding_round_half_up_to_cents_then_sum",
      ...Object.values(f.ledger.identities[0]!),
    ])
      expect(markup).toContain(text);
    const appendix = markup.match(/<pre>([\s\S]*)<\/pre>/u)![1]!;
    const decoded = appendix
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&gt;", ">")
      .replaceAll("&lt;", "<")
      .replaceAll("&amp;", "&");
    expect(JSON.parse(decoded)).toEqual(report);
    expect(markup).not.toMatch(
      /<button|<input|<select|<a |<script|<iframe|<img|<details open/iu,
    );
  });
  it("escapes hostile source messages and preserves Unicode as passive text", () => {
    const f = portfolioReviewReportFixture();
    const message =
      '</pre></style><script src="https://invalid.example/x"> & Café 東京 📈';
    const report = preparePortfolioReviewReport({
      ...f,
      state: {
        ...f.state,
        message,
        rows: f.state.rows.map((row) => ({
          ...row,
          message,
          showingPrevious: true,
        })),
      },
    })!;
    const before = JSON.stringify(report);
    const markup = renderToStaticMarkup(
      <PortfolioReviewReportSnapshot report={report} />,
    );
    expect(markup).toContain("&lt;/pre&gt;&lt;/style&gt;&lt;script");
    expect(markup).toContain("Café 東京 📈");
    expect(markup).toContain("Previous history retained");
    expect(markup).not.toMatch(/<(?:script|a|img|iframe)(?:\s|>)/u);
    expect(JSON.stringify(report)).toBe(before);
  });
  it("does not display a forged report", () => {
    expect(
      renderToStaticMarkup(
        <PortfolioReviewReportSnapshot report={{} as never} />,
      ),
    ).toBe("");
  });
});
