import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createScreenResearchReviewFixture } from "./test-screen-research-review-fixture";
import { eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import {
  isPreparedScreenResearchReport,
  type PreparedScreenResearchReport,
} from "./managed-screen-research-review";
import { ScreenResearchReportSnapshot } from "./ScreenResearchReportSnapshot";
import { ManagedScreenResearchReading } from "./ManagedScreenResearchReading";
import { createScreenResearchReportSource } from "./ManagedScreenResearchReport";
import { ScreenResearchReportController } from "./screen-research-report-controller";
import {
  screenResearchReportHtmlByteLength,
  SCREEN_RESEARCH_REPORT_HTML_MAX_BYTES,
  formatScreenResearchReportHtml,
} from "./screen-research-report-html";
import type {
  ScreenResearchReportDeliveryAdapter,
  ScreenResearchReportHtmlDocument,
} from "./screen-research-report-ports";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

afterEach(() => vi.useRealTimers());
async function paired() {
  const f = await createScreenResearchReviewFixture();
  const calculations = vi.spyOn(f.valuation, "calculate");
  for (const side of [0, 1]) {
    const visit = await f.open(side);
    if (side === 0) {
      const filings = filingsResponse(0, "available", visit.selection);
      f.setEvidence({
        ...f.getEvidence(),
        price: {
          selection: visit.selection,
          available: true,
          selectedRange: "1m",
          response: eodResponse(),
          responseOrigin: "company",
          showingPrevious: true,
          running: false,
          catalogChanged: false,
          message: "Price refresh failed; previous history retained.",
          error: true,
        },
        filings: {
          selection: visit.selection,
          supported: true,
          response: filings,
          responseOrigin: "request",
          lastCheck: filings,
          refreshComparison: null,
          showingPrevious: false,
          running: false,
          catalogChanged: false,
          message: "No matching filings observed.",
          error: false,
        },
      });
    }
    f.setWatchlist({
      member: {
        ...visit.selection.listing,
        note: `  Company ${side}\r\nCafé 東京 📈 <script>alert(1)</script>  `,
      },
      canEdit: true,
    });
    f.valuation.calculate();
    f.model.reconcile();
    expect(f.model.capture(f.model.getSnapshot(), visit)).not.toBeNull();
    f.back();
  }
  return { ...f, calculations };
}
async function controlled() {
  const f = await paired();
  let active = true;
  const source = createScreenResearchReportSource(f.model, () => active);
  const deliver = vi
    .fn<ScreenResearchReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const format = vi.fn(
    (
      report: PreparedScreenResearchReport,
    ): ScreenResearchReportHtmlDocument => ({
      purpose: "investment.screen-research-html",
      filename: `Investment-paired-research-${report.preparedAt.replace(/[-:.]/gu, "")}.html`,
      text: "invented transport-only",
      byteLength: 23,
    }),
  );
  const controller = new ScreenResearchReportController(
    source,
    { deliver },
    format,
  );
  return {
    ...f,
    controller,
    deliver,
    format,
    source,
    route: (value: boolean) => {
      active = value;
      controller.reconcile();
    },
  };
}
describe("complete paired research report", () => {
  it("keeps the complete independent captures and offline disclosures with no passive effects", async () => {
    const f = await paired();
    const before = f.model.getSnapshot();
    const capture = f.model.captureReport(before)!;
    expect(capture.current()).toBe(true);
    expect(capture.report.reading).toBe(before.reading);
    const $ = load(
      renderToStaticMarkup(
        <ScreenResearchReportSnapshot report={capture.report} />,
      ),
    );
    expect(JSON.parse($("[data-paired-research-payload]").text())).toEqual(
      capture.report,
    );
    expect(
      $("script,img,iframe,object,form,button,input,select,canvas"),
    ).toHaveLength(0);
    expect($.text()).toContain("2025-12-31");
    expect($.text()).toContain("2025-06-30");
    expect($("[aria-label='Authored valuation results']")).toHaveLength(2);
    expect($.text()).toContain("The last Price request failed.");
    expect($.text()).toContain("100.25");
    expect($.text()).toContain("101.5");
    expect(new TextEncoder().encode($.html()).byteLength).toBeLessThan(
      SCREEN_RESEARCH_REPORT_HTML_MAX_BYTES,
    );
    for (const side of ["left", "right"] as const) {
      const reading = capture.report.reading[side];
      const article = $(`[data-research-reading-side=${side}]`);
      const packet = article
        .find("details")
        .filter(
          (_i, el) =>
            $(el).children("summary").text() ===
            "Complete Annual state and source packets",
        );
      expect(JSON.parse(packet.children("pre").text())).toEqual(
        reading.evidence.annual,
      );
      expect(JSON.parse(article.find("textarea").text())).toEqual(
        JSON.parse(reading.document.text),
      );
      expect(article.text()).toContain(reading.evaluatedAt!);
    }
    expect(f.annualReport).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledOnce();
    expect(f.calculations).toHaveBeenCalledTimes(2);
    expect(f.model.getSnapshot()).toBe(before);
    expect(isPreparedScreenResearchReport({ ...capture.report })).toBe(false);
    expect(
      renderToStaticMarkup(
        <ScreenResearchReportSnapshot report={{ ...capture.report }} />,
      ),
    ).toBe("");
  });
  it("keeps preview labels distinct from the retained live pair", async () => {
    const f = await paired();
    const report = f.model.captureReport(f.model.getSnapshot())!.report;
    const $ = load(
      renderToStaticMarkup(
        <>
          <ManagedScreenResearchReading capture={report.reading.left} />
          <ManagedScreenResearchReading capture={report.reading.right} />
          <details open>
            <summary>Prepared report preview</summary>
            <ScreenResearchReportSnapshot report={report} />
          </details>
        </>,
      ),
    );
    const ids = $("[id]")
      .toArray()
      .map((el) => $(el).attr("id"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const side of ["left", "right"] as const) {
      for (const prefix of ["managed-screen-research", "paired-report"]) {
        const id = `${prefix}-document-${side}`;
        expect($(`label[for="${id}"]`)).toHaveLength(1);
        expect($(`textarea#${id}`)).toHaveLength(1);
        expect($(`textarea#${id}`).text()).toBe(
          report.reading[side].document.text,
        );
        expect($(`textarea#${id}`).attr("aria-describedby")).toBe(
          `${id}-scope`,
        );
        expect($(`#${id}-scope`)).toHaveLength(1);
      }
    }
  });
  it("requires both captured companies and the returned pair; clock reentry cannot capture a retired pair", async () => {
    const f = await createScreenResearchReviewFixture();
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    const visit = await f.open(0);
    f.model.capture(f.model.getSnapshot(), visit);
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    f.back();
    expect(f.model.captureReport(f.model.getSnapshot())).toBeNull();
    const full = await paired();
    full.setClock(() => {
      full.model.invalidate();
      return new Date();
    });
    expect(full.model.captureReport(full.model.getSnapshot())).toBeNull();
  });
  it("cannot revive a report handle after unavailable/available ABA without an observer", async () => {
    const f = await paired();
    const capture = f.model.captureReport(f.model.getSnapshot())!;
    f.setAvailable(false);
    f.setAvailable(true);
    expect(capture.current()).toBe(false);
    expect(f.model.captureReport(f.model.getSnapshot())?.current()).toBe(true);
  });
  it("refuses whole oversized or malformed output and cannot format a forged report", async () => {
    expect(
      screenResearchReportHtmlByteLength(
        "é".repeat(SCREEN_RESEARCH_REPORT_HTML_MAX_BYTES / 2),
      ),
    ).toBe(SCREEN_RESEARCH_REPORT_HTML_MAX_BYTES);
    expect(
      screenResearchReportHtmlByteLength(
        "é".repeat(SCREEN_RESEARCH_REPORT_HTML_MAX_BYTES / 2) + "x",
      ),
    ).toBeNull();
    expect(screenResearchReportHtmlByteLength("\ud800")).toBeNull();
    expect(screenResearchReportHtmlByteLength("")).toBeNull();
    const f = await paired();
    const report = f.model.captureReport(f.model.getSnapshot())!.report;
    expect(formatScreenResearchReportHtml({ ...report })).toBeNull();
  });
  it("saves exactly the explicit capture without reads or calculations", async () => {
    const f = await controlled();
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    f.controller.prepare();
    const report = f.controller.getSnapshot().report!;
    await f.controller.save();
    expect(f.format).toHaveBeenCalledWith(report);
    expect(f.deliver).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().message).toContain("written");
    expect(f.annualReport).toHaveBeenCalledTimes(2);
    expect(f.calculations).toHaveBeenCalledTimes(2);
    f.controller.dispose();
  });
  for (const reason of ["clear", "retire", "unavailable", "route"] as const)
    it(`cancels pending delivery on ${reason} and fences late success`, async () => {
      const f = await controlled();
      let context!: TextDocumentDeliveryContext;
      let finish!: (value: TextDocumentDeliveryResult) => void;
      f.deliver.mockImplementation((_d, c) => {
        context = c;
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      f.controller.prepare();
      const task = f.controller.save();
      if (reason === "clear") f.model.clearSide(f.model.getSnapshot(), "right");
      else if (reason === "retire") f.model.retire();
      else if (reason === "unavailable") {
        f.setAvailable(false);
        f.setAvailable(true);
      } else {
        f.route(false);
        f.route(true);
      }
      expect(context.signal.aborted).toBe(true);
      expect(context.isCurrent()).toBe(false);
      finish("written");
      await task;
      expect(f.controller.getSnapshot().report).toBeNull();
      f.controller.dispose();
    });
  it("keeps capture after cancellation or failure; a later explicit save can succeed", async () => {
    const f = await controlled();
    f.controller.prepare();
    const report = f.controller.getSnapshot().report;
    f.deliver.mockResolvedValueOnce("cancelled");
    await f.controller.save();
    expect(f.controller.getSnapshot().report).toBe(report);
    f.deliver.mockRejectedValueOnce(new Error("invented write failure"));
    await f.controller.save();
    expect(f.controller.getSnapshot().message).toContain("could not be saved");
    await f.controller.save();
    expect(f.controller.getSnapshot().message).toContain("written");
    f.controller.dispose();
  });
  it("rechecks after formatting and after a saving announcement reenters", async () => {
    for (const stage of ["announcement", "format"]) {
      const f = await controlled();
      f.controller.prepare();
      if (stage === "announcement")
        f.controller.subscribe(() => {
          if (f.controller.getSnapshot().saving) f.model.invalidate();
        });
      else
        f.format.mockImplementation(() => {
          f.model.invalidate();
          return {
            purpose: "investment.screen-research-html",
            filename: "unused",
            text: "unused",
            byteLength: 6,
          };
        });
      await f.controller.save();
      expect(f.deliver).not.toHaveBeenCalled();
      f.controller.dispose();
    }
  });
});
