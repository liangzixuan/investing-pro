import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { createScreenComparisonReportFixture } from "./screen-comparison-report-fixture";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";
import {
  formatScreenComparisonReportHtml,
  isScreenComparisonReportHtmlDocument,
  screenComparisonReportHtmlByteLength,
  SCREEN_COMPARISON_REPORT_HTML_MAX_BYTES,
} from "./screen-comparison-report-html";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
  COMPANY_REPORT_HTML_STYLE_HASH,
} from "./company-report-html-style";
afterEach(() => vi.useRealTimers());
describe("complete passive comparison reading copy", () => {
  it("renders all3group snapshot with complete identities, independent periods and original clocks", async () => {
    const f = await createScreenComparisonReportFixture();
    const report = f.capture()!.report;
    const $ = load(
      renderToStaticMarkup(<ScreenComparisonReportSnapshot report={report} />),
    );
    for (const label of ["Income statement", "Balance sheet", "Cash flow"])
      expect(
        $("h4")
          .toArray()
          .filter((el) => $(el).text() === label),
      ).toHaveLength(2);
    expect($("script,img,iframe,form,button,input,select")).toHaveLength(0);
    expect($.text()).toContain(
      report.left.response.evidence.generation.completedAt,
    );
    expect($.text()).toContain(
      report.right.response.evidence.generation.completedAt,
    );
    expect($.text()).toContain(report.catalogSnapshotSha256);
    expect($.text()).toContain("2025-12-31");
    expect($.text()).toContain("2025-06-30");
    for (const side of ["left", "right"] as const) {
      expect($.text()).toContain(report[side].listing.listingId);
      expect($.text()).toContain(report[side].listing.shareClassId);
      expect($.text()).toContain(report[side].response.evidence.cik);
    }
    expect($.text()).toContain("Ticker · ascending");
    expect($.text()).toContain("No numeric filters");
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("keeps raw authored criteria text but labels fields, operators, units and sort", async () => {
    const f = await createScreenComparisonReportFixture({
      criteria: {
        clauses: [
          { field: "operatingIncome", operator: "lte", value: "12.3400" },
        ],
        sort: { field: "currentRatio", direction: "desc" },
      },
    });
    const report = f.capture()!.report;
    const $ = load(
      renderToStaticMarkup(<ScreenComparisonReportSnapshot report={report} />),
    );
    expect($.text()).toContain("Reported operating income at most 12.3400 USD");
    expect($.text()).toContain(
      "Current assets / current liabilities · descending",
    );
    expect(report.criteria.clauses[0]!.value).toBe("12.3400");
    expect($.text()).toContain("Share class ID");
    expect($.text()).toContain("SEC source CIK");
  });
  it("preserves the exact restrictive existing style/CSP; never falls back to a server formatter", async () => {
    expect(
      createHash("sha256").update(COMPANY_REPORT_HTML_STYLE).digest("base64"),
    ).toBe("0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ=");
    expect(COMPANY_REPORT_HTML_CSP).toContain(
      `style-src '${COMPANY_REPORT_HTML_STYLE_HASH}'`,
    );
    for (const directive of [
      "default-src",
      "script-src",
      "connect-src",
      "img-src",
      "font-src",
      "object-src",
      "frame-src",
      "base-uri",
      "form-action",
    ])
      expect(COMPANY_REPORT_HTML_CSP).toContain(`${directive} 'none'`);
    const f = await createScreenComparisonReportFixture();
    expect(typeof document).toBe("undefined");
    expect(formatScreenComparisonReportHtml(f.capture()!.report)).toBeNull();
  });
  it("rejects forged captures/documents, invalid UTF16 and oversized whole output without clipping", async () => {
    const f = await createScreenComparisonReportFixture();
    const report = f.capture()!.report;
    expect(
      renderToStaticMarkup(
        <ScreenComparisonReportSnapshot report={{ ...report }} />,
      ),
    ).toBe("");
    expect(formatScreenComparisonReportHtml({ ...report })).toBeNull();
    const hostile = new Proxy(
      {},
      {
        get() {
          throw Error("must not read");
        },
        ownKeys() {
          throw Error("must not inspect");
        },
      },
    );
    expect(isScreenComparisonReportHtmlDocument(hostile)).toBe(false);
    expect(screenComparisonReportHtmlByteLength("\ud800")).toBeNull();
    expect(
      screenComparisonReportHtmlByteLength(
        "x".repeat(SCREEN_COMPARISON_REPORT_HTML_MAX_BYTES + 1),
      ),
    ).toBeNull();
    expect(
      screenComparisonReportHtmlByteLength(
        "é".repeat(SCREEN_COMPARISON_REPORT_HTML_MAX_BYTES / 2 + 1),
      ),
    ).toBeNull();
    expect(
      screenComparisonReportHtmlByteLength(
        "x".repeat(SCREEN_COMPARISON_REPORT_HTML_MAX_BYTES),
      ),
    ).toBe(SCREEN_COMPARISON_REPORT_HTML_MAX_BYTES);
  });
});
