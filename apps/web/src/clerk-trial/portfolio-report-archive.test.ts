import { describe, expect, it } from "vitest";
import {
  archiveBytes,
  archiveHtmlFixture,
  archiveReportFixture,
  archiveWithJson,
} from "./portfolio-report-archive-fixture";
import {
  isPortfolioReportArchive,
  parsePortfolioReportArchive,
  PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES,
} from "./portfolio-report-archive";
import {
  isPreparedPortfolioReviewReport,
  preparePortfolioReviewReport,
} from "./portfolio-review-report";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";

const parse = (text: string) => parsePortfolioReportArchive(archiveBytes(text));
describe("strict passive Portfolio archive admission", () => {
  it("round trips complete rendered evidence into an immutable separate private copy", () => {
    const report = archiveReportFixture(),
      html = archiveHtmlFixture(report);
    const archive = parse(html);
    expect(archive).toEqual(report);
    expect(archive).not.toBe(report);
    expect(archive.ledger).not.toBe(report.ledger);
    expect(Object.isFrozen(archive.sourceRows[0]!.response!.rows)).toBe(true);
    expect(isPortfolioReportArchive(archive)).toBe(true);
    expect(isPreparedPortfolioReviewReport(archive)).toBe(false);
    expect(isPortfolioReportArchive(report)).toBe(false);
    expect(isPortfolioReportArchive(structuredClone(archive))).toBe(false);
    expect(typeof document).toBe("undefined");
  });
  it("preserves Unicode and hostile-looking authored text as data", () => {
    const input = portfolioReviewReportFixture();
    input.state = {
      ...input.state,
      message: "Café 東京 📈 </pre><script>alert(1)</script> & raw \\ud800",
    };
    const report = preparePortfolioReviewReport(input)!;
    expect(parse(archiveHtmlFixture(report)).message).toBe(input.state.message);
    const escaped = JSON.stringify(report).replace("📈", "\\ud83d\\udcc8");
    expect(parse(archiveWithJson(escaped)).message).toBe(input.state.message);
  });
  it("preserves the complete maximum authored ledger and retained failed-refresh packet", () => {
    const base = portfolioReviewReportFixture().ledger;
    const input = portfolioReviewReportInput({
      ...base,
      transactions: Array.from({ length: 250 }, (_, index) => ({
        id: `deposit-${index}`,
        date: "2026-09-02",
        type: "deposit" as const,
        listingId: null,
        shares: null,
        grossUsd: "1.00",
        feeUsd: "0.00",
      })),
    });
    input.state = {
      ...input.state,
      rows: input.state.rows.map((row) => ({
        ...row,
        showingPrevious: true,
        message: "Refresh failed; original clock retained.",
      })),
    };
    const report = preparePortfolioReviewReport(input)!;
    const admitted = parse(archiveHtmlFixture(report));
    expect(admitted).toEqual(report);
    expect(admitted.ledger.transactions).toHaveLength(250);
    expect(admitted.sourceRows[0]!.showingPrevious).toBe(true);
    expect(admitted.sourceRows[0]!.response!.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
  });
  it("preserves unavailable composition and rejects overflowing JSON numbers at null fields", () => {
    const base = portfolioReviewReportFixture().ledger;
    const input = portfolioReviewReportInput({
      ...base,
      opening: { ...base.opening, cashUsd: null },
    });
    const report = preparePortfolioReviewReport(input)!;
    expect(report.review.composition.reason).toBe("unknown_cash");
    expect(parse(archiveHtmlFixture(report))).toEqual(report);
    for (const number of ["1e999", "-1e999"])
      expect(() =>
        parse(
          archiveWithJson(
            JSON.stringify(report).replace(
              '"totalValueUsd":null',
              `"totalValueUsd":${number}`,
            ),
          ),
        ),
      ).toThrow(TypeError);
    expect(() =>
      parse(
        archiveWithJson(
          JSON.stringify(report).replace('"cashUsd":null', '"cashUsd":-0'),
        ),
      ),
    ).toThrow(TypeError);
  });
  it("does not invent an observed date for an empty-holdings capture", () => {
    const base = portfolioReviewReportFixture().ledger;
    const input = portfolioReviewReportInput(
      { ...base, identities: [], opening: { ...base.opening, holdings: [] } },
      "2026-09-19",
      [],
    );
    expect(preparePortfolioReviewReport(input)).toBeNull();
    const raw = {
      kind: "portfolio_holdings_review",
      preparedAt: input.preparedAt,
      ledger: input.ledger,
      portfolio: input.portfolio,
      review: input.review,
      sourceRows: [],
      selectedDate: input.state.selectedDate,
      dates: [],
      message: input.state.message,
    };
    expect(() => parse(archiveWithJson(raw))).toThrow(TypeError);
  });
  it("accepts the exact file byte bound and rejects one byte more", () => {
    const html = archiveHtmlFixture();
    const padded = html.replace(
      "</body>",
      `${" ".repeat(PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES - archiveBytes(html).byteLength)}</body>`,
    );
    expect(archiveBytes(padded).byteLength).toBe(
      PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES,
    );
    expect(parse(padded).kind).toBe("portfolio_holdings_review");
    expect(() => parse(`${padded} `)).toThrow(TypeError);
    expect(() =>
      parsePortfolioReportArchive(new Uint8Array([0xc0, 0xaf]).buffer),
    ).toThrow(TypeError);
    expect(() => parsePortfolioReportArchive(new ArrayBuffer(0))).toThrow(
      TypeError,
    );
  });
  it.each([
    [
      "prototype attribute",
      (s: string) => s.replace("<body>", '<body __proto__="ignored">'),
    ],
    ["unfinished trailing tag", (s: string) => `${s}<meta content="`],
    ["unfinished trailing close", (s: string) => `${s}</aside`],
    [
      "closing tag attributes",
      (s: string) => s.replace("</pre>", "</pre forged>"),
    ],
    [
      "wrong format",
      (s: string) =>
        s.replace(
          'name="investment-report-format" content="1"',
          'name="investment-report-format" content="2"',
        ),
    ],
    [
      "wrong purpose",
      (s: string) =>
        s.replace(
          "investment.portfolio-review-html",
          "investment.company-review-html",
        ),
    ],
    ["missing closing root", (s: string) => s.replace("</html>", "")],
    [
      "unmatched closing tag",
      (s: string) => s.replace("</body>", "</aside></body>"),
    ],
    [
      "nested appendix markup",
      (s: string) => s.replace("<pre>", "<pre><span>"),
    ],
    [
      "duplicate appendix",
      (s: string) =>
        s.replace(
          "</article>",
          `${s.match(/<details><summary>Complete report document[\s\S]*?<\/pre><\/details>/u)![0]}</article>`,
        ),
    ],
    [
      "duplicate metadata",
      (s: string) =>
        s.replace(
          "</head>",
          '<meta name="investment-report-format" content="1"></head>',
        ),
    ],
    [
      "duplicate attribute",
      (s: string) =>
        s.replace('<html lang="en">', '<html lang="en" LANG="en">'),
    ],
    [
      "event handler",
      (s: string) => s.replace("<body>", '<body onload="alert(1)">'),
    ],
    [
      "script",
      (s: string) => s.replace("</body>", "<script>alert(1)</script></body>"),
    ],
    [
      "external resource",
      (s: string) =>
        s.replace("</body>", '<img src="https://invalid.example/x"></body>'),
    ],
    [
      "modified stylesheet",
      (s: string) =>
        s.replace(
          "</style>",
          "body {background:url(https://invalid.example/x)}</style>",
        ),
    ],
    [
      "wrong filename",
      (s: string) =>
        s.replace("Investment-portfolio-review-", "Company-review-"),
    ],
    [
      "nesting budget",
      (s: string) =>
        s.replace(
          "</article>",
          `${"<div>".repeat(65)}${"</div>".repeat(65)}</article>`,
        ),
    ],
    [
      "element budget",
      (s: string) =>
        s.replace("</article>", `${"<span></span>".repeat(200_001)}</article>`),
    ],
  ])("rejects %s without HTML execution", (_name, mutate) => {
    expect(() => parse(mutate(archiveHtmlFixture()))).toThrow(TypeError);
  });
  it.each([
    "kind",
    "totals",
    "composition",
    "ledger",
    "projection",
    "source identity",
    "source catalog",
    "provider",
    "range",
    "clock",
    "dates",
    "running",
    "retained without packet",
    "missing row",
    "extra property",
    "invalid Unicode",
  ])("rejects altered %s", (kind) => {
    const report = structuredClone(archiveReportFixture());
    switch (kind) {
      case "kind":
        Object.assign(report, { kind: "company_review" });
        break;
      case "totals":
        Object.assign(report.review, { totalValueUsd: "0.00" });
        break;
      case "composition":
        Object.assign(report.review.composition, { cashPercent: "99.99" });
        break;
      case "ledger":
        Object.assign(report.ledger.opening, { cashUsd: "999.00" });
        break;
      case "projection":
        Object.assign(report.portfolio.holdings[0]!, { shares: "999" });
        break;
      case "source identity":
        Object.assign(report.sourceRows[0]!.response!.security, {
          issuerName: "Forged issuer",
        });
        break;
      case "source catalog":
        Object.assign(report.sourceRows[0]!.response!, {
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        });
        break;
      case "provider":
        Object.assign(report.sourceRows[0]!.response!, { provider: "other" });
        break;
      case "range":
        Object.assign(report.sourceRows[0]!.response!, { range: "1y" });
        break;
      case "clock":
        Object.assign(report.sourceRows[0]!.response!, {
          completedAt: "2020-01-01T00:00:00.000Z",
        });
        break;
      case "dates":
        Object.assign(report, { selectedDate: "2026-09-17" });
        break;
      case "running":
        Object.assign(report.sourceRows[0]!, { running: true });
        break;
      case "retained without packet":
        Object.assign(report.sourceRows[0]!, {
          response: null,
          showingPrevious: true,
        });
        break;
      case "missing row":
        Object.assign(report, { sourceRows: [] });
        break;
      case "extra property":
        Object.assign(report.sourceRows[0]!, { extra: "not captured" });
        break;
      case "invalid Unicode":
        Object.assign(report, { message: "\ud800" });
        break;
    }
    expect(() => parse(archiveWithJson(report))).toThrow(TypeError);
  });
  it("rejects raw duplicate and escaped duplicate JSON keys, depth overflow and trailing data", () => {
    const json = JSON.stringify(archiveReportFixture());
    for (const text of [
      json.replace('{"kind":', '{"kind":"portfolio_holdings_review","kind":'),
      json.replace(
        '{"kind":',
        '{"k\\u0069nd":"portfolio_holdings_review","kind":',
      ),
      `${json} {}`,
      "[".repeat(258) + "0" + "]".repeat(258),
    ])
      expect(() => parse(archiveWithJson(text))).toThrow(TypeError);
  });
});
