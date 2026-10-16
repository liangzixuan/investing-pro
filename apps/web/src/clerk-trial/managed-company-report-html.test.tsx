import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  derivePersonalSecAnnualFinancialReview,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import { TrialApiError } from "./api";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
  COMPANY_REPORT_HTML_STYLE_HASH,
} from "./company-report-html-style";
import {
  COMPANY_REPORT_HTML_MAX_BYTES,
  formatCompanyReportHtml,
  isCompanyReportHtmlDocument,
} from "./managed-company-report-html";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import {
  prepareCompanyReport,
  type PreparedCompanyReport,
} from "./managed-company-report";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import {
  financialReviewResponse,
  type FinancialReviewFixtureOptions,
} from "./financial-review-fixture";

const note =
  'Cafe\u0301 \u6771\u4eac \ud83d\udcc8\n</pre></style><script src="https://invalid.example/x">& exact  ';
const clock = () => new Date("2026-10-15T00:00:00.000Z");

async function fixture(
  options: FinancialReviewFixtureOptions = {},
  loaded: "all" | "price" | "filings" = "all",
) {
  const priceRead = vi.fn().mockResolvedValue(eodResponse());
  const annualRead = vi
    .fn()
    .mockResolvedValue(await financialReviewResponse(options));
  const filingsRead = vi
    .fn()
    .mockResolvedValue(filingsResponse(2, "available", eodSelection));
  const price = new ManagedEodHistory(priceRead, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(annualRead, vi.fn());
  const filings = new ManagedCompanyFilings(filingsRead, vi.fn());
  for (const model of [price, annual, filings]) model.open(eodSelection);
  if (loaded !== "filings") await price.load();
  if (loaded === "all") await annual.load();
  if (loaded !== "price") await filings.load();
  const prepare = () =>
    prepareCompanyReport(
      eodSelection,
      companySnapshotEvidence(
        eodSelection,
        price.getSnapshot(),
        annual.getSnapshot(),
        filings.getSnapshot(),
      ),
      {
        member: { ...eodSelection.listing, note },
        canEdit: true,
        canAdd: false,
        reason: null,
      },
      clock,
    )!;
  return {
    report: prepare(),
    prepare,
    priceRead,
    annualRead,
    filingsRead,
    annual,
  };
}

// Server rendering is test-only. Runtime formatting uses the detached browser DOM.
function render(report: PreparedCompanyReport) {
  const json = formatCompanyReportDocument(report)!;
  return {
    json,
    markup: renderToStaticMarkup(
      <CompanyReportHtmlView report={report} jsonText={json.text} />,
    ),
  };
}
function escape(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}
function fact(markup: string, label: string) {
  const start = markup.indexOf(
    `<section class="fact"><h3>${escape(label)}</h3>`,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  return markup.slice(start, markup.indexOf("</section>", start));
}

describe("passive readable company report", () => {
  it("shows independent signed/zero facts despite the missing income pair, without reads or mutation", async () => {
    const f = await fixture();
    const before = JSON.stringify(f.report);
    const { markup } = render(f.report);
    const expected = ["250.125", "120.125", "-80.125", "0", "-7.5"];
    const rows = derivePersonalSecAnnualFinancialReview(
      f.report.evidence.annual!.response!.evidence,
    );
    expect(markup.match(/class="fact"/gu)).toHaveLength(5);
    rows.forEach((row, index) => {
      const section = fact(markup, row.label);
      expect(section).toContain(`USD ${expected[index]}`);
      expect(section).toContain(`Amount sign: ${row.sign}`);
      expect(section).toContain("0000000001-26-000001");
      expect(section).toContain(
        "Within current-use limits at the original load.",
      );
      expect(section).toContain("2025-12-31");
      expect(section).toContain("<details><summary>Inputs and references:");
      row.value.observationIds.forEach((id) => expect(section).toContain(id));
    });
    expect(markup).toContain("Period 2025-01-01 to 2025-12-31.");
    expect(markup).toContain("As of 2025-12-31.");
    expect(markup).toContain(
      "Parent equity excludes noncontrolling interests.",
    );
    expect(markup).not.toMatch(/<details\s+open/u);
    expect(JSON.stringify(f.report)).toBe(before);
    for (const read of [f.priceRead, f.annualRead, f.filingsRead])
      expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps both exact calculation operands and all their references in closed details", async () => {
    const { report } = await fixture();
    const { markup } = render(report);
    const rows = derivePersonalSecAnnualFinancialReview(
      report.evidence.annual!.response!.evidence,
    );
    for (const row of rows) {
      if (!row.operands) continue;
      const section = fact(markup, row.label);
      const details = section.slice(section.indexOf("<details>"));
      const operands: readonly PersonalSecAnnualFinancialReviewRow["value"][] =
        row.key === "workingCapital"
          ? [row.operands.currentAssets, row.operands.currentLiabilities]
          : row.key === "operatingCashFlowLessPpePurchases"
            ? [row.operands.operatingCashFlow, row.operands.ppePurchases]
            : [];
      for (const value of operands) {
        expect(value.status).toBe("available");
        if (value.status === "available")
          expect(details).toContain(`USD ${value.value}`);
        value.observationIds.forEach((id) => expect(details).toContain(id));
      }
    }
    expect(fact(markup, rows[2]!.label)).toContain("Less PP&amp;E purchases");
    expect(fact(markup, rows[3]!.label)).toContain("Less current liabilities");
  });

  it("keeps full long admitted amounts and their calculated difference without display rounding", async () => {
    const long = "9".repeat(64);
    const { report } = await fixture({
      operatingIncome: long,
      operatingCashFlow: "0",
      ppePurchases: long,
    });
    const { markup } = render(report);
    expect(fact(markup, "Reported operating income")).toContain(`USD ${long}`);
    expect(fact(markup, "Operating cash flow less PP&E purchases")).toContain(
      `USD -${long}`,
    );
    expect(fact(markup, "Operating cash flow less PP&E purchases")).toContain(
      `USD ${long}`,
    );
  });

  it.each([
    { operatingIncome: null },
    { ppePurchases: null },
    { currentLiabilities: null },
    { shareholdersEquity: null },
  ])(
    "retains independent refusal reasons and the remaining admitted facts: %j",
    async (options) => {
      const { report } = await fixture(options);
      const { markup } = render(report);
      const rows = derivePersonalSecAnnualFinancialReview(
        report.evidence.annual!.response!.evidence,
      );
      expect(markup.match(/class="fact"/gu)).toHaveLength(5);
      for (const row of rows) {
        const section = fact(markup, row.label);
        if (row.value.status === "unavailable") {
          expect(section).toContain(
            `Unavailable. Reason: ${row.value.reason}.`,
          );
        } else expect(section).toContain(`USD ${row.value.value}`);
      }
    },
  );

  it("preserves historical qualifications and original source clocks", async () => {
    const { report } = await fixture({ cutoffAt: "2028-09-20T00:00:00.000Z" });
    const { markup } = render(report);
    expect(
      markup.match(
        /Historical value; outside current-use limits at the original load\./gu,
      ),
    ).toHaveLength(9);
    for (const value of [
      "2028-09-20T00:00:00.000Z",
      "2028-09-20T00:00:01.000Z",
      "2028-09-20T00:00:02.000Z",
      report.preparedAt,
    ])
      expect(markup).toContain(value);
  });

  it("keeps retained evidence, failed-attempt warnings and original dates after a real model failure", async () => {
    const f = await fixture();
    f.annualRead.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.annual.load();
    const report = f.prepare();
    const { markup } = render(report);
    expect(report.evidence.annual!.showingPrevious).toBe(true);
    expect(markup).toContain("Retained previous response.");
    expect(markup).toContain("The latest source attempt failed.");
    expect(markup).toContain("2026-09-20T00:00:02.000Z");
    expect(markup).toContain("USD 250.125");
    expect(f.annualRead).toHaveBeenCalledTimes(2);
  });

  it.each(["price", "filings"] as const)(
    "does not invent Annual facts in a %s-only report",
    async (loaded) => {
      const f = await fixture({}, loaded);
      const { markup } = render(f.report);
      expect(markup).toContain(
        "No Annual facts are inferred from another source.",
      );
      expect(markup).not.toContain('class="fact"');
      expect(f.annualRead).not.toHaveBeenCalled();
    },
  );

  it.each([null, ""])(
    "distinguishes absent and empty authored notes: %j",
    async (value) => {
      const { report } = await fixture();
      const { markup } = render({ ...report, note: value });
      expect(markup).toContain(
        value === null
          ? "not in the watchlist draft"
          : "watchlist draft note was empty",
      );
      expect(markup).not.toContain('class="note"');
    },
  );

  it("escapes hostile note text, preserves Unicode/whitespace and includes the complete canonical JSON", async () => {
    const { report } = await fixture();
    const { markup, json } = render(report);
    expect(markup).toContain(`<p class="note">${escape(note)}</p>`);
    expect(markup).toContain(`<pre>${escape(json.text)}</pre>`);
    const decoded = JSON.parse(json.text) as {
      authoredResearch: { note: string };
    };
    expect(decoded.authoredResearch.note).toBe(note);
    expect(markup).not.toMatch(
      /<(?:script|style|img|iframe|link|form|input|button|a)(?:\s|>)/u,
    );
    expect(markup).not.toMatch(/<[^>]*\s(?:href|src|on\w+|style)=/u);
    expect(markup).toContain("<summary>Complete captured JSON</summary>");
    expect(markup.match(/<pre>/gu)).toHaveLength(1);
  });

  it("retains complete identity and captured Price/Filings coverage and clocks", async () => {
    const { report } = await fixture();
    const { markup } = render(report);
    for (const value of Object.values(report.selection.listing))
      expect(markup).toContain(escape(value));
    expect(markup).toContain(report.selection.catalogSnapshotSha256);
    const price = report.evidence.price!.response!;
    const filings = report.evidence.filings!.response!;
    for (const value of [
      price.window.startDate,
      price.window.endDate,
      price.requestStartedAt,
      price.completedAt,
      filings.window.fromDate,
      filings.window.throughDate,
      filings.requestStartedAt,
      filings.completedAt,
    ])
      expect(markup).toContain(value);
    expect(markup).toContain("raw USD closes, unadjusted");
    expect(markup).toContain(
      "Older continuation files and filing contents were not loaded",
    );
  });
});

describe("HTML file handoff boundary", () => {
  it("pins the exact static stylesheet in a restrictive no-script/no-network CSP", () => {
    expect(
      `sha256-${createHash("sha256").update(COMPANY_REPORT_HTML_STYLE).digest("base64")}`,
    ).toBe(COMPANY_REPORT_HTML_STYLE_HASH);
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
    expect(COMPANY_REPORT_HTML_CSP).not.toContain("unsafe-inline");
    expect(COMPANY_REPORT_HTML_STYLE).not.toMatch(/url\(|@import/iu);
    expect(COMPANY_REPORT_HTML_STYLE).toContain("white-space: pre-wrap");
    expect(COMPANY_REPORT_HTML_STYLE).toContain("overflow-wrap: anywhere");
    expect(COMPANY_REPORT_HTML_STYLE).toContain("min-height: 44px");
  });

  it("rejects unowned values without reading accessors or proxy traps", () => {
    let traps = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          traps++;
          throw new Error();
        },
        ownKeys() {
          traps++;
          throw new Error();
        },
        getOwnPropertyDescriptor() {
          traps++;
          throw new Error();
        },
      },
    );
    const getter = Object.defineProperty({}, "purpose", {
      get() {
        traps++;
        throw new Error();
      },
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [
      null,
      undefined,
      false,
      "html",
      [],
      {},
      hostile,
      getter,
      revoked.proxy,
      Object.freeze({
        purpose: "investment.company-research-html",
        filename: "fake.html",
        text: "<html></html>",
        byteLength: 13,
      }),
    ])
      expect(isCompanyReportHtmlDocument(value)).toBe(false);
    expect(traps).toBe(0);
  });

  it("refuses formatting without a browser DOM; it does not add a fake renderer", async () => {
    const { report } = await fixture();
    expect(typeof document).toBe("undefined");
    expect(formatCompanyReportHtml(report)).toBeNull();
    expect(COMPANY_REPORT_HTML_MAX_BYTES).toBe(8 * 1024 * 1024);
  });

  it("preserves the canonical formatter's unsafe note and filename refusals before rendering", async () => {
    const { report } = await fixture();
    expect(formatCompanyReportHtml({ ...report, note: "\ud800" })).toBeNull();
    expect(
      formatCompanyReportHtml({ ...report, note: "<".repeat(20_000) }),
    ).toBeNull();
    expect(
      formatCompanyReportHtml({ ...report, preparedAt: "invalid" }),
    ).toBeNull();
  });
});
