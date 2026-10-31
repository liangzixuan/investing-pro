import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { PortfolioComparisonReportSnapshot } from "./PortfolioComparisonReportSnapshot";
import { portfolioComparisonReportFixture } from "./portfolio-comparison-report-fixture";

describe("complete passive Portfolio comparison view", () => {
  it("renders every union state, both full reports, complete raw appendix and unverified-file qualification", () => {
    const report = portfolioComparisonReportFixture();
    const $ = load(
      renderToStaticMarkup(
        <PortfolioComparisonReportSnapshot report={report} />,
      ),
    );
    expect($("[data-portfolio-comparison-row]")).toHaveLength(
      report.comparison.rows.length,
    );
    for (const row of report.comparison.rows)
      expect(
        $(`[data-portfolio-comparison-row='${row.listingId}']`).attr(
          "data-comparison-status",
        ),
      ).toBe(row.status);
    expect(
      JSON.parse($("pre[data-portfolio-comparison-document='1']").text()),
    ).toEqual(report);
    expect(
      $("article[aria-label='Captured Portfolio holdings review']"),
    ).toHaveLength(2);
    for (const value of [
      report.savedFilename,
      report.preparedAt,
      report.comparison.saved.preparedAt,
      report.comparison.current.preparedAt,
      "unverified private evidence",
      "Unavailable",
      "Unknown",
      "Previous history retained",
      "Other invented issuer identity",
      "<script>literal</script>",
    ])
      expect($.text()).toContain(value);
    for (const side of [report.comparison.saved, report.comparison.current])
      for (const row of side.sourceRows) {
        expect($.text()).toContain(row.holding.identity.shareClassId);
        if (row.response)
          expect($.text()).toContain(row.response.requestStartedAt);
      }
    expect(
      $("script,img,iframe,form,button,input,select,a[href],link"),
    ).toHaveLength(0);
    const ids = $("[id]")
      .toArray()
      .map((el) => $(el).attr("id"));
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      renderToStaticMarkup(
        <PortfolioComparisonReportSnapshot report={{ ...report }} />,
      ),
    ).toBe("");
  });
});
