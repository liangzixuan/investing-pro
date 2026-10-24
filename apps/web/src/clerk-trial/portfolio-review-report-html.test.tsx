import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
  COMPANY_REPORT_HTML_STYLE_HASH,
} from "./company-report-html-style";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import { portfolioReviewReportFixture } from "./portfolio-review-report-fixture";
import {
  formatPortfolioReviewReportHtml,
  isPortfolioReviewReportHtmlDocument,
  portfolioReviewReportHtmlByteLength,
  PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES,
} from "./portfolio-review-report-html";

describe("passive Portfolio HTML file boundary", () => {
  it("uses the unchanged restrictive fixed stylesheet policy", () => {
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
  });
  it("does not substitute a server renderer when the detached browser DOM is absent", () => {
    expect(typeof document).toBe("undefined");
    expect(
      formatPortfolioReviewReportHtml(
        preparePortfolioReviewReport(portfolioReviewReportFixture())!,
      ),
    ).toBeNull();
    expect(formatPortfolioReviewReportHtml({} as never)).toBeNull();
  });
  it("accepts bounded UTF-8 without replacement of invalid Unicode", () => {
    expect(PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES).toBe(8 * 1024 * 1024);
    expect(portfolioReviewReportHtmlByteLength("Café 東京 📈")).toBe(
      new TextEncoder().encode("Café 東京 📈").byteLength,
    );
    for (const text of [
      "",
      "\ud800",
      "\udfff",
      "a".repeat(PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES + 1),
      "é".repeat(PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES / 2 + 1),
    ])
      expect(portfolioReviewReportHtmlByteLength(text)).toBeNull();
    expect(
      portfolioReviewReportHtmlByteLength(
        "a".repeat(PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES),
      ),
    ).toBe(PORTFOLIO_REVIEW_REPORT_HTML_MAX_BYTES);
  });
  it("rejects cloned and hostile document objects without reading traps", () => {
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          reads++;
          throw new Error();
        },
        ownKeys() {
          reads++;
          throw new Error();
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [
      null,
      undefined,
      "html",
      {},
      hostile,
      revoked.proxy,
      {
        purpose: "investment.portfolio-review-html",
        filename: "fake.html",
        text: "fake",
        byteLength: 4,
      },
    ])
      expect(isPortfolioReviewReportHtmlDocument(value)).toBe(false);
    expect(reads).toBe(0);
  });
});
