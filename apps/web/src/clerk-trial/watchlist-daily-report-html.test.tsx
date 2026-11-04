import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { createFinishedWatchlistDailyReportFixture } from "./test-watchlist-daily-report-fixture";
import {
  formatWatchlistDailyReportHtml,
  isWatchlistDailyReportHtmlDocument,
} from "./watchlist-daily-report-html";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";

// Controlled detached-document boundary; the actual Snapshot is rendered in full.
// This checks serialization and envelope assembly, not browser DOM or native delivery.
vi.mock("react-dom/client", () => ({
  createRoot: (body: { markup: string }) => ({
    render: (node: ReactNode) => {
      body.markup = renderToStaticMarkup(node);
    },
    unmount: () => undefined,
  }),
}));
vi.mock("react-dom", () => ({ flushSync: (action: () => void) => action() }));
function element(tag: string) {
  const $ = load(`<${tag}></${tag}>`, undefined, false);
  const node = $.root().children().first();
  return {
    setAttribute: (name: string, value: string) => {
      node.attr(name, value);
    },
    set name(value: string) {
      node.attr("name", value);
    },
    set content(value: string) {
      node.attr("content", value);
    },
    set httpEquiv(value: string) {
      node.attr("http-equiv", value);
    },
    set textContent(value: string) {
      node.text(value);
    },
    get outerHTML() {
      return $.html(node);
    },
  };
}
function documentBoundary() {
  const body = { markup: "" };
  let head = "";
  const documentElement = {
    lang: "",
    get outerHTML() {
      return `<html lang="${this.lang}"><head>${head}</head><body>${body.markup}</body></html>`;
    },
  };
  return {
    createElement: element,
    documentElement,
    body,
    head: {
      replaceChildren: (...nodes: ReturnType<typeof element>[]) => {
        head = nodes.map((n) => n.outerHTML).join("");
      },
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
it("assembles complete real report markup in the exact passive native envelope", async () => {
  vi.stubGlobal("document", {
    implementation: { createHTMLDocument: documentBoundary },
  });
  const f = await createFinishedWatchlistDailyReportFixture();
  try {
    const counts = f.fixture.watchlistSavedScenario!.getSnapshot();
    const report = f.workspace.getWatchlistDailyReportSource().capture()!
      .report;
    const document = formatWatchlistDailyReportHtml(report)!;
    expect(document).not.toBeNull();
    expect(isWatchlistDailyReportHtmlDocument(document)).toBe(true);
    expect(isWatchlistDailyReportHtmlDocument({ ...document })).toBe(false);
    expect(document.purpose).toBe("investment.watchlist-daily-html");
    expect(document.filename).toMatch(
      /^Investment-watchlist-daily-\d{8}T\d{9}Z\.html$/u,
    );
    expect(document.byteLength).toBe(
      new TextEncoder().encode(document.text).length,
    );
    const $ = load(document.text);
    expect($("title").text()).toBe("Watchlist daily review");
    expect(
      $('meta[http-equiv="Content-Security-Policy"]').attr("content"),
    ).toBe(COMPANY_REPORT_HTML_CSP);
    expect($("style").text()).toBe(COMPANY_REPORT_HTML_STYLE);
    expect($('meta[name="investment-report-purpose"]').attr("content")).toBe(
      document.purpose,
    );
    expect(
      $("script,form,input,select,button,canvas,img,iframe,object"),
    ).toHaveLength(0);
    expect(
      JSON.parse($("[data-watchlist-daily-report-payload]").text()),
    ).toEqual(report);
    const raw = report.rows[0]!.evidence.price!.response!.rows;
    const rows = $("[data-daily-report-listing]")
      .first()
      .find('[aria-label="All retained raw USD closes"] tbody tr');
    expect(
      rows.toArray().map((row) =>
        $(row)
          .children()
          .toArray()
          .map((cell) => $(cell).text()),
      ),
    ).toEqual(raw.map((row) => [row.date, row.close]));
    expect(document.text.endsWith("</main></body></html>\n")).toBe(true);
    expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toBe(counts);
  } finally {
    f.dispose();
  }
});
