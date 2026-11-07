import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createWatchlistResearchPairFixture } from "./test-watchlist-research-pair-fixture";
import { WatchlistResearchReportSnapshot } from "./WatchlistResearchReportSnapshot";
import {
  formatWatchlistResearchReportHtml,
  WATCHLIST_RESEARCH_REPORT_HTML_MAX_BYTES,
  watchlistResearchReportHtmlByteLength,
} from "./watchlist-research-report-html";

import {
  createWatchlistResearchReportSource,
  watchlistResearchReportMessages,
} from "./ManagedWatchlistResearchReport";
import { OwnedReportController } from "./owned-report-controller";
import {
  isPreparedWatchlistResearchReport,
  type PreparedWatchlistResearchReport,
} from "./managed-watchlist-research-pair";
import type {
  WatchlistResearchReportDeliveryAdapter,
  WatchlistResearchReportHtmlDocument,
} from "./watchlist-research-report-ports";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

async function paired() {
  const f = await createWatchlistResearchPairFixture();
  f.choose(1);
  const calculate = vi.spyOn(f.valuation, "calculate");
  for (const side of ["left", "right"] as const) {
    const visit = f.open(side);
    if (side === "left") await f.loadAnnual();
    f.valuation.calculate();
    f.model.reconcile();
    expect(f.model.capture(f.model.getSnapshot(), visit)).not.toBeNull();
    f.back();
  }
  return { ...f, calculate };
}

describe("complete Watchlist research report", () => {
  it("renders both exact share classes and full passive payloads without screen provenance or effects", async () => {
    const f = await paired();
    const before = f.model.getSnapshot();
    const report = f.model.captureReport(before)!.report;
    const $ = load(
      renderToStaticMarkup(<WatchlistResearchReportSnapshot report={report} />),
    );
    expect(JSON.parse($("[data-watchlist-research-payload]").text())).toEqual(
      report,
    );
    expect(
      $("script,img,iframe,object,form,button,input,select,canvas"),
    ).toHaveLength(0);
    expect($.text()).toContain("Thesis 東京 Ω 2.000001");
    expect($.text()).toContain("2025-12-31");
    expect($.text()).not.toContain("Screen criteria");
    expect($.text()).not.toContain("Annual-pass comparison");
    for (const side of ["left", "right"] as const) {
      const reading = report.reading[side];
      const article = $(`[data-research-reading-side=${side}]`);
      expect(article.text()).toContain(reading.evaluatedAt!);
      expect(JSON.parse(article.find("textarea").text())).toEqual(
        JSON.parse(reading.document.text),
      );
      expect($.text()).toContain(reading.selection.listing.listingId);
    }
    expect(f.model.getSnapshot()).toBe(before);
    expect(f.annualRead).toHaveBeenCalledOnce();
    expect(f.calculate).toHaveBeenCalledTimes(2);
    expect(f.unexpected).not.toHaveBeenCalled();
  });

  it("refuses copied payloads and bounds complete UTF-8 output without truncation", async () => {
    const f = await paired();
    const report = f.model.captureReport(f.model.getSnapshot())!.report;
    expect(
      renderToStaticMarkup(
        <WatchlistResearchReportSnapshot report={{ ...report }} />,
      ),
    ).toBe("");
    expect(formatWatchlistResearchReportHtml({ ...report })).toBeNull();
    expect(watchlistResearchReportHtmlByteLength("")).toBeNull();
    expect(watchlistResearchReportHtmlByteLength("\ud800")).toBeNull();
    expect(watchlistResearchReportHtmlByteLength("\udfff")).toBeNull();
    expect(watchlistResearchReportHtmlByteLength("東京📈")).toBe(10);
    const max = WATCHLIST_RESEARCH_REPORT_HTML_MAX_BYTES;
    expect(watchlistResearchReportHtmlByteLength("a".repeat(max))).toBe(max);
    expect(
      watchlistResearchReportHtmlByteLength("a".repeat(max + 1)),
    ).toBeNull();
    expect(
      watchlistResearchReportHtmlByteLength("é".repeat(max / 2 + 1)),
    ).toBeNull();
  });
});

async function controlled() {
  const f = await paired();
  let active = true;
  const source = createWatchlistResearchReportSource(f.model, () => active);
  const deliver = vi
    .fn<WatchlistResearchReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const format = vi.fn(
    (
      report: PreparedWatchlistResearchReport,
    ): WatchlistResearchReportHtmlDocument | null => ({
      purpose: "investment.watchlist-research-html",
      filename: `Investment-watchlist-research-${report.preparedAt.replace(/[-:.]/gu, "")}.html`,
      text: "synthetic transport",
      byteLength: 19,
    }),
  );
  const controller = new OwnedReportController(
    source,
    { deliver },
    {
      admit: isPreparedWatchlistResearchReport,
      format,
      messages: watchlistResearchReportMessages,
    },
  );
  return {
    ...f,
    controller,
    deliver,
    format,
    route: (value: boolean) => {
      active = value;
      controller.reconcile();
    },
  };
}
describe("owned Watchlist report delivery", () => {
  it("prepares explicitly, retains a cancelled preview, and saves with no extra reads or calculations", async () => {
    const f = await controlled();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.controller.prepare();
    const report = f.controller.getSnapshot().report;
    expect(report).not.toBeNull();
    f.deliver.mockResolvedValueOnce("cancelled");
    await f.controller.save();
    expect(f.controller.getSnapshot().report).toBe(report);
    await f.controller.save();
    expect(f.controller.getSnapshot().message).toContain("written");
    expect(f.annualRead).toHaveBeenCalledOnce();
    expect(f.calculate).toHaveBeenCalledTimes(2);
    f.controller.dispose();
  });
  for (const event of ["note", "saving", "clear", "route", "end"] as const) {
    it(`withdraws during delivery on ${event}, including equal-value restoration`, async () => {
      const f = await controlled();
      let context!: TextDocumentDeliveryContext;
      let finish!: (result: TextDocumentDeliveryResult) => void;
      f.deliver.mockImplementation((_document, current) => {
        context = current;
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      f.controller.prepare();
      const saving = f.controller.save();
      if (event === "note") f.note("New thesis");
      if (event === "saving") {
        f.setContext({ available: false });
        f.setContext({ available: true });
      }
      if (event === "clear") f.model.clearSide(f.model.getSnapshot(), "left");
      if (event === "route") {
        f.route(false);
        f.route(true);
      }
      if (event === "end") f.model.end(f.model.getSnapshot());
      expect(context.signal.aborted).toBe(true);
      expect(context.isCurrent()).toBe(false);
      finish("written");
      await saving;
      expect(f.controller.getSnapshot().report).toBeNull();
      expect(f.controller.getSnapshot().message).not.toContain("written");
      f.controller.dispose();
    });
  }
  it("rechecks ownership after formatting and after synchronous save listeners", async () => {
    for (const stage of ["format", "listener"]) {
      const f = await controlled();
      f.controller.prepare();
      if (stage === "listener")
        f.controller.subscribe(() => {
          if (f.controller.getSnapshot().saving) f.note("Changed while saving");
        });
      else
        f.format.mockImplementation(() => {
          f.note("Changed while formatting");
          return null;
        });
      await f.controller.save();
      expect(f.deliver).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot().report).toBeNull();
      f.controller.dispose();
    }
  });
});
