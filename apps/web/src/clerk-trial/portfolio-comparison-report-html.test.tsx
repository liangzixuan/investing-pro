import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
  COMPANY_REPORT_HTML_STYLE_HASH,
} from "./company-report-html-style";
import {
  formatPortfolioComparisonReportHtml,
  isPortfolioComparisonReportHtmlDocument,
  portfolioComparisonReportHtmlByteLength,
  PORTFOLIO_COMPARISON_REPORT_HTML_MAX_BYTES,
} from "./portfolio-comparison-report-html";
import { portfolioComparisonReportFixture } from "./portfolio-comparison-report-fixture";

describe("private Portfolio comparison HTML boundary", () => {
  it("retains the exact existing passive style and restrictive content policy", () => {
    expect(
      createHash("sha256").update(COMPANY_REPORT_HTML_STYLE).digest("base64"),
    ).toBe("0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ=");
    expect(COMPANY_REPORT_HTML_CSP).toContain(
      `style-src '${COMPANY_REPORT_HTML_STYLE_HASH}'`,
    );
    for (const key of [
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
      expect(COMPANY_REPORT_HTML_CSP).toContain(`${key} 'none'`);
  });
  it("rejects forged captures and documents and does not substitute a server formatter", () => {
    const report = portfolioComparisonReportFixture();
    expect(typeof document).toBe("undefined");
    expect(formatPortfolioComparisonReportHtml(report)).toBeNull();
    expect(formatPortfolioComparisonReportHtml({ ...report })).toBeNull();
    expect(
      isPortfolioComparisonReportHtmlDocument({
        purpose: "investment.portfolio-comparison-html",
      }),
    ).toBe(false);
  });
  it("measures whole UTF8 bytes at the8MiB boundary and rejects malformed Unicode", () => {
    const cap = PORTFOLIO_COMPARISON_REPORT_HTML_MAX_BYTES;
    expect(cap).toBe(8 * 1024 * 1024);
    expect(portfolioComparisonReportHtmlByteLength("é".repeat(cap / 2))).toBe(
      cap,
    );
    expect(portfolioComparisonReportHtmlByteLength("📈".repeat(cap / 4))).toBe(
      cap,
    );
    for (const text of [
      "",
      "\ud800",
      "\udfff",
      "x".repeat(cap + 1),
      "é".repeat(cap / 2) + "a",
    ])
      expect(portfolioComparisonReportHtmlByteLength(text)).toBeNull();
  });
});
