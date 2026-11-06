import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { screenPassReportFixture } from "./test-screen-pass-review-report-fixture";
import { ScreenPassReviewReportSnapshot } from "./ScreenPassReviewReportSnapshot";
import { ScreenPassReviewReportController } from "./screen-pass-review-report-controller";
import { createNativeScreenPassReviewReportFixture } from "../../android-tests/managed-workspace/native-screen-pass-review-report-fixture";
import type { InvestmentScreenPassReviewReportPlugin } from "./screen-pass-review-report-delivery";
import {
  formatScreenPassReviewReportHtml,
  isScreenPassReviewReportHtmlDocument,
  screenPassReviewReportHtmlByteLength,
  SCREEN_PASS_REVIEW_REPORT_HTML_MAX_BYTES,
} from "./screen-pass-review-report-html";
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("renders complete previous/current packets, criteria and clocks offline before any disclosure opens", async () => {
  const f = await screenPassReportFixture();
  try {
    const report = f.source.capture()!.report;
    const preview = load(
      renderToStaticMarkup(<ScreenPassReviewReportSnapshot report={report} />),
    );
    expect(preview("pre").length).toBe(0);
    expect(preview("button,input,select,textarea,form").length).toBe(0);
    vi.stubGlobal("document", {
      implementation: { createHTMLDocument: documentBoundary },
    });
    const html = formatScreenPassReviewReportHtml(report)!;
    expect(html).not.toBeNull();
    expect(isScreenPassReviewReportHtmlDocument(html)).toBe(true);
    const $ = load(html.text);
    expect(
      JSON.parse($("pre[data-screen-pass-report-payload]").text()),
    ).toEqual(report);
    expect($("[data-pass-report-listing]").length).toBe(2);
    $("[data-pass-report-listing]").each((i, row) => {
      for (const [side, run] of [
        ["previous", report.plan.sourceRun],
        ["current", report.current],
      ] as const) {
        expect(
          JSON.parse($(row).find(`[data-pass-side=${side}] pre`).text()),
        ).toEqual(run.rows[i]);
      }
    });
    expect(
      $("script,form,input,select,textarea,button,iframe,img,link").length,
    ).toBe(0);
    expect(
      $("meta[http-equiv='Content-Security-Policy']").attr("content"),
    ).toBe(COMPANY_REPORT_HTML_CSP);
    expect($("style").text()).toBe(COMPANY_REPORT_HTML_STYLE);
    expect(html.byteLength).toBe(
      new TextEncoder().encode(html.text).byteLength,
    );
    expect(f.meta.getSnapshot()).toMatchObject({ annual: 4, save: 0 });
    expect(
      formatScreenPassReviewReportHtml(structuredClone(report)),
    ).toBeNull();
  } finally {
    f.dispose();
  }
});
it("rejects malformed UTF-8 and oversized whole documents without truncation", () => {
  expect(screenPassReviewReportHtmlByteLength("\ud800")).toBeNull();
  expect(
    screenPassReviewReportHtmlByteLength(
      "é".repeat(SCREEN_PASS_REVIEW_REPORT_HTML_MAX_BYTES / 2 + 1),
    ),
  ).toBeNull();
  expect(screenPassReviewReportHtmlByteLength("")).toBeNull();
  expect(screenPassReviewReportHtmlByteLength("東京 📈")).toBe(
    new TextEncoder().encode("東京 📈").byteLength,
  );
});

it("keeps full report bytes through chooser cancel and write, then saves and reloads the resource independently", async () => {
  const f = await screenPassReportFixture();
  vi.stubGlobal("document", {
    implementation: { createHTMLDocument: documentBoundary },
  });
  const plugin = {
    choose: vi
      .fn<InvestmentScreenPassReviewReportPlugin["choose"]>()
      .mockResolvedValueOnce({ status: "cancelled" })
      .mockResolvedValue({
        status: "chosen",
        handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    write: vi
      .fn<InvestmentScreenPassReviewReportPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentScreenPassReviewReportPlugin["cancel"]>()
      .mockResolvedValue(undefined),
  };
  const bridge = createNativeScreenPassReviewReportFixture(plugin),
    c = new ScreenPassReviewReportController(
      f.source,
      bridge.delivery,
      formatScreenPassReviewReportHtml,
    );
  try {
    c.prepare();
    const report = c.getSnapshot().report!,
      counts = f.meta.getSnapshot();
    await c.save();
    expect(c.getSnapshot().report).toBe(report);
    expect(c.getSnapshot().message).toContain("cancelled");
    expect(plugin.write).not.toHaveBeenCalled();
    await c.save();
    expect(c.getSnapshot().message).toBe(
      "Annual-pass report written to the chosen document.",
    );
    expect(bridge.getSnapshot()).toMatchObject({
      choices: 2,
      writes: 1,
      writeRequests: 1,
    });
    const html = plugin.write.mock.calls[0]![0] as { text: string };
    expect(
      JSON.parse(
        load(html.text)("pre[data-screen-pass-report-payload]").text(),
      ),
    ).toEqual(report);
    expect(new TextEncoder().encode(html.text).byteLength).toBe(
      bridge.getSnapshot().byteLength,
    );
    expect(f.meta.getSnapshot()).toBe(counts);
    expect(f.w.coordinator.getSnapshot()).toBe(f.resource);
    f.w.setView("watchlist");
    await f.w.reviewCatalog();
    f.w.applyReview();
    await f.w.coordinator.save();
    await f.w.coordinator.load();
    expect(f.meta.saved().payload).toEqual(f.resource.draft);
    expect(f.meta.getSnapshot()).toMatchObject({
      annual: 4,
      load: 2,
      save: 1,
      resolve: 2,
      rejected: 0,
      unexpected: {},
    });
    expect(c.getSnapshot().report).toBeNull();
  } finally {
    c.dispose();
    f.dispose();
  }
});
