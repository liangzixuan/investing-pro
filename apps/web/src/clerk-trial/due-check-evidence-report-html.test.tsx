import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { finishedDueCheckReportFixture } from "./test-due-check-evidence-report-fixture";
import { DueCheckEvidenceReportSnapshot } from "./DueCheckEvidenceReportSnapshot";
import {
  formatDueCheckEvidenceReportHtml,
  isDueCheckEvidenceReportHtmlDocument,
  dueCheckEvidenceReportHtmlByteLength,
  DUE_CHECK_EVIDENCE_REPORT_HTML_MAX_BYTES,
} from "./due-check-evidence-report-html";
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
it("keeps the actual default-context preview passive and complete while raw disclosures remain lazy", async () => {
  const f = await finishedDueCheckReportFixture();
  try {
    const report = f.source.capture()!.report;
    const before = f.workspace.followups.coordinator.getSnapshot();
    const $ = load(
      renderToStaticMarkup(<DueCheckEvidenceReportSnapshot report={report} />),
    );
    expect($("button,input,select,textarea,canvas,script,form")).toHaveLength(
      0,
    );
    expect($("pre")).toHaveLength(0);
    expect($("[data-due-check-report-entry]")).toHaveLength(3);
    expect($.text()).toContain("Final authored assessment");
    expect($.text()).toContain(report.rows[0]!.reading!.capturedAt);
    expect(
      $("summary")
        .toArray()
        .some(
          (e) => $(e).text() === "Complete finished due-check report payload",
        ),
    ).toBe(true);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  } finally {
    f.dispose();
  }
});
it.each([false, true])(
  "serializes the whole chosen report, current and captured checks, and original source fields (partial=%s)",
  async (partial) => {
    vi.stubGlobal("document", {
      implementation: { createHTMLDocument: documentBoundary },
    });
    const f = await finishedDueCheckReportFixture(partial);
    try {
      const saved = f.workspace.followups.coordinator.getSnapshot();
      const report = f.source.capture()!.report;
      const reading = formatDueCheckEvidenceReportHtml(report)!;
      expect(isDueCheckEvidenceReportHtmlDocument(reading)).toBe(true);
      expect(isDueCheckEvidenceReportHtmlDocument({ ...reading })).toBe(false);
      const $ = load(reading.text);
      expect($("title").text()).toBe("Finished due-check evidence review");
      expect(reading.filename).toBe(
        `Investment-due-check-evidence-${report.preparedAt.replace(/[-:.]/gu, "")}.html`,
      );
      expect(reading.purpose).toBe("investment.due-check-evidence-html");
      expect(
        $("meta[http-equiv=Content-Security-Policy]").attr("content"),
      ).toBe(COMPANY_REPORT_HTML_CSP);
      expect($("style").text()).toBe(COMPANY_REPORT_HTML_STYLE);
      expect(
        $(
          "script,form,input,select,textarea,button,canvas,img,iframe,object,[src]",
        ),
      ).toHaveLength(0);
      expect(
        $("[data-due-check-report-entry]")
          .toArray()
          .map((e) => $(e).attr("data-due-check-report-entry")),
      ).toEqual(report.rows.map((r) => r.entry.id));
      const raw = $("details")
        .filter(
          (_i, e) =>
            $(e).children("summary").text() ===
            "Complete finished due-check report payload",
        )
        .find("pre");
      expect(raw).toHaveLength(1);
      expect(JSON.parse(raw.text())).toEqual(report);
      for (const row of report.rows) {
        const scope = $(`[data-due-check-report-entry="${row.entry.id}"]`);
        expect(scope.text()).toContain(row.entry.check);
        expect(scope.text()).toContain(row.entry.result);
        if (row.reading) {
          const payload = scope
            .find("details")
            .filter(
              (_i, e) =>
                $(e).children("summary").text() ===
                "Complete retained check reading",
            )
            .find("pre");
          expect(JSON.parse(payload.text())).toEqual(row.reading);
          const closes = row.reading.evidence.price?.response?.rows ?? [];
          expect(
            scope
              .find('[aria-label="Captured Price"] table tbody tr')
              .toArray()
              .map((e) =>
                $(e)
                  .children()
                  .toArray()
                  .map((c) => $(c).text()),
              ),
          ).toEqual(closes.map((r) => [r.date, r.close]));
        } else expect(scope.text()).toContain("No source reading was retained");
      }
      const unrelated = saved.draft!.entries.find(
        (e) => !report.rows.some((r) => r.entry.id === e.id),
      )!;
      expect(reading.text).not.toContain(unrelated.id);
      expect(reading.byteLength).toBe(
        new TextEncoder().encode(reading.text).length,
      );
      expect(reading.text.endsWith("</main></body></html>\n")).toBe(true);
      expect(f.workspace.followups.coordinator.getSnapshot()).toBe(saved);
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
    } finally {
      f.dispose();
    }
  },
);
it("refuses empty, malformed UTF-16 and whole oversized reports without truncation", () => {
  expect(dueCheckEvidenceReportHtmlByteLength("")).toBeNull();
  expect(dueCheckEvidenceReportHtmlByteLength("x\ud800")).toBeNull();
  expect(
    dueCheckEvidenceReportHtmlByteLength(
      "é".repeat(DUE_CHECK_EVIDENCE_REPORT_HTML_MAX_BYTES / 2 + 1),
    ),
  ).toBeNull();
  expect(
    dueCheckEvidenceReportHtmlByteLength(
      "x".repeat(DUE_CHECK_EVIDENCE_REPORT_HTML_MAX_BYTES),
    ),
  ).toBe(DUE_CHECK_EVIDENCE_REPORT_HTML_MAX_BYTES);
});
