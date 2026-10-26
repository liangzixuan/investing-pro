import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
  COMPANY_REPORT_HTML_STYLE_HASH,
} from "./company-report-html-style";
import { prepareFollowupsReviewReport } from "./followups-review-report";
import { followupsReviewReportFixture } from "./followups-review-report-fixture";
import {
  formatFollowupsReviewReportHtml,
  isFollowupsReviewReportHtmlDocument,
  followupsReviewReportHtmlByteLength,
  FOLLOWUPS_REVIEW_REPORT_HTML_MAX_BYTES,
} from "./followups-review-report-html";

describe("Follow-ups report HTML document boundary", () => {
  it("keeps the existing fixed restrictive stylesheet and CSP", () => {
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
    ]) {
      expect(COMPANY_REPORT_HTML_CSP).toContain(`${directive} 'none'`);
    }
    expect(COMPANY_REPORT_HTML_STYLE).toContain(
      ".note, pre { white-space: pre-wrap; }",
    );
    expect(COMPANY_REPORT_HTML_STYLE).toContain("overflow-wrap: anywhere");
  });
  it("refuses absent detached DOM and unowned captures without substituting a renderer", () => {
    expect(typeof document).toBe("undefined");
    expect(
      formatFollowupsReviewReportHtml(
        prepareFollowupsReviewReport(followupsReviewReportFixture())!,
      ),
    ).toBeNull();
    expect(formatFollowupsReviewReportHtml({} as never)).toBeNull();
  });
  it("admits exactly8MiB UTF-8 and refuses the whole text one byte above", () => {
    const limit = 8388608;
    expect(FOLLOWUPS_REVIEW_REPORT_HTML_MAX_BYTES).toBe(limit);
    for (const text of [
      "a".repeat(limit),
      "é".repeat(limit / 2),
      "📈".repeat(limit / 4),
    ]) {
      expect(followupsReviewReportHtmlByteLength(text)).toBe(limit);
      expect(followupsReviewReportHtmlByteLength(text + "a")).toBeNull();
    }
    expect(followupsReviewReportHtmlByteLength("Café 東京 📈")).toBe(17);
    for (const text of [
      "",
      "\ud800",
      "\udfff",
      "valid\ud800tail",
      "a".repeat(limit + 1),
    ]) {
      expect(followupsReviewReportHtmlByteLength(text)).toBeNull();
    }
  });
  it("does not accept forged or cloned documents or inspect hostile object traps", () => {
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          reads++;
          throw new Error("trap");
        },
        ownKeys() {
          reads++;
          throw new Error("trap");
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const candidate of [
      null,
      undefined,
      "html",
      {},
      hostile,
      revoked.proxy,
      {
        purpose: "investment.followups-review-html",
        filename: "Investment-followups-review-20261026T030405678Z.html",
        text: "forged",
        byteLength: 6,
      },
    ])
      expect(isFollowupsReviewReportHtmlDocument(candidate)).toBe(false);
    expect(reads).toBe(0);
  });
});
