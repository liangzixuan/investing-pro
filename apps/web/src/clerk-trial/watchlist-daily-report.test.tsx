import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createWatchlistValuationFixture } from "./test-watchlist-valuation-review-fixture";
import { createFinishedWatchlistDailyReportFixture } from "./test-watchlist-daily-report-fixture";
import {
  isPreparedWatchlistDailyReport,
  type PreparedWatchlistDailyReport,
} from "./watchlist-daily-report";
import { WatchlistDailyReportSnapshot } from "./WatchlistDailyReportSnapshot";
import { WatchlistDailyReportController } from "./watchlist-daily-report-controller";
import {
  watchlistDailyReportHtmlByteLength,
  WATCHLIST_DAILY_REPORT_HTML_MAX_BYTES,
  formatWatchlistDailyReportHtml,
} from "./watchlist-daily-report-html";
import type {
  WatchlistDailyReportDeliveryAdapter,
  WatchlistDailyReportHtmlDocument,
} from "./watchlist-daily-report-ports";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
const fixtures: Awaited<ReturnType<typeof createWatchlistValuationFixture>>[] =
  [];
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
async function setup(finished = true) {
  const f = await (finished
    ? createFinishedWatchlistDailyReportFixture()
    : createWatchlistValuationFixture());
  fixtures.push(f);
  return f;
}
function control(f: Awaited<ReturnType<typeof setup>>) {
  const deliver = vi
    .fn<WatchlistDailyReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const format = vi.fn(
    (
      report: PreparedWatchlistDailyReport,
    ): WatchlistDailyReportHtmlDocument | null => ({
      purpose: "investment.watchlist-daily-html",
      filename: `Investment-watchlist-daily-${report.preparedAt.replace(/[-:.]/gu, "")}.html`,
      text: "invented transport-only",
      byteLength: 23,
    }),
  );
  const controller = new WatchlistDailyReportController(
    f.workspace.getWatchlistDailyReportSource(),
    { deliver },
    format,
  );
  return { controller, deliver, format };
}
it("captures the finished evaluated group as detached selected evidence without load, calculation or Save", async () => {
  const f = await setup();
  const source = f.workspace.getWatchlistDailyReportSource();
  expect(source).toBe(f.workspace.getWatchlistDailyReportSource());
  const group = f.group.getSnapshot(),
    scenarios = f.model.getSnapshot();
  const counters = f.fixture.watchlistSavedScenario!.getSnapshot(),
    editor = f.workspace.valuation.getSnapshot();
  const capture = source.capture()!;
  expect(capture).not.toBeNull();
  expect(capture.current()).toBe(true);
  expect(
    capture.report.rows.map((r) => r.evidence.member.listing.listingId),
  ).toEqual(group.chosen.map((r) => r.listing.listingId));
  expect(capture.report.rows[0]!.evidence).toEqual({
    ...group.rows[0],
    member: { listing: group.rows[0]!.member.listing },
  });
  expect(capture.report.rows[0]!.evidence).not.toBe(group.rows[0]);
  expect(capture.report.scenarios!.outcomes).toEqual(scenarios.reading!.rows);
  expect(capture.report.scenarios!.outcomes).not.toBe(scenarios.reading!.rows);
  expect(Object.keys(capture.report.scenarios!)).not.toContain("collection");
  expect(JSON.stringify(capture.report)).not.toContain('"payload":{"entries"');
  expect(
    Object.isFrozen(capture.report.scenarios!.outcomes![0]!.calculation),
  ).toBe(true);
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toBe(counters);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.group.getSnapshot()).toBe(group);
});
it("renders every raw packet and all six outcomes with unique IDs and escaped authored text", async () => {
  const f = await setup(false);
  await f.run();
  const plan = await f.preview();
  f.model.evaluate(plan!);
  const note =
    "  Caf\u00e9 \u6771\u4eac \ud83d\udcc8 <script>never execute</script>\r\nfull note  ";
  f.workspace.note(
    f.group.getSnapshot().rows[0]!.member.listing.listingId,
    note,
  );
  f.group.finishDaily(f.group.getSnapshot());
  const capture = f.workspace.getWatchlistDailyReportSource().capture()!;
  const $ = load(
    renderToStaticMarkup(
      <WatchlistDailyReportSnapshot report={capture.report} />,
    ),
  );
  expect(JSON.parse($("[data-watchlist-daily-report-payload]").text())).toEqual(
    capture.report,
  );
  expect(capture.report.rows[0]!.watchlist.value!.note).toBe(note);
  expect(capture.report.resources.watchlist.dirty).toBe(true);
  expect($("[data-daily-report-listing]")).toHaveLength(3);
  expect($("[aria-label='Authored valuation results']")).toHaveLength(2);
  expect(capture.report.scenarios!.outcomes![0]!.comparison!.rows).toHaveLength(
    6,
  );
  expect($.text()).toContain(
    "No confirmed saved valuation inputs for this listing.",
  );
  expect($.text()).toContain("price_not_loaded");
  expect(
    $("script,img,iframe,object,form,button,input,select,canvas"),
  ).toHaveLength(0);
  const ids = $("[id]")
    .toArray()
    .map((e) => $(e).attr("id"));
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    renderToStaticMarkup(
      <WatchlistDailyReportSnapshot report={{ ...capture.report }} />,
    ),
  ).toBe("");
});
it("refuses active groups, then preserves unloaded checks, absent plan and unprepared scenarios", async () => {
  const f = await setup(false);
  const source = f.workspace.getWatchlistDailyReportSource();
  expect(source.capture()).toBeNull();
  f.group.finishDaily(f.group.getSnapshot());
  const report = source.capture()!.report;
  expect(report.scenarios).toBeNull();
  expect(report.rows.every((r) => r.check.status === "unloaded")).toBe(true);
  const html = renderToStaticMarkup(
    <WatchlistDailyReportSnapshot report={report} />,
  );
  expect(html).toContain("No source plan prepared");
  expect(html).toContain("Saved scenarios were not previewed");
});
it("keeps a preview without evaluation and never calculates implicitly", async () => {
  const f = await setup(false);
  await f.preview();
  f.group.finishDaily(f.group.getSnapshot());
  const report = f.workspace.getWatchlistDailyReportSource().capture()!.report;
  expect(report.scenarios!.outcomes).toBeNull();
  expect(report.scenarios!.evaluatedAt).toBeNull();
  expect(
    renderToStaticMarkup(<WatchlistDailyReportSnapshot report={report} />),
  ).toContain("not evaluated");
});
it.each([
  "note-ABA",
  "load",
  "catalog",
  "collection-file",
  "editor-file",
  "watchlist-file",
  "followups-file",
  "navigation-ABA",
  "blocked-ABA",
  "reset",
  "session",
] as const)(
  "retires capture on %s including equal-value restoration",
  async (kind) => {
    const f = await setup();
    const capture = f.workspace.getWatchlistDailyReportSource().capture()!;
    const { controller } = control(f);
    controller.prepare();
    const token = {};
    if (kind === "note-ABA") {
      const row = f.group.getSnapshot().rows[0]!;
      const note =
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
      f.workspace.note(row.member.listing.listingId, "changed");
      f.workspace.note(row.member.listing.listingId, note);
    }
    if (kind === "catalog") await f.workspace.refreshCatalog();
    if (kind === "load")
      await f.workspace.valuationAssumptions.coordinator.load();
    if (kind === "collection-file") {
      f.workspace.valuationAssumptions.beginCollectionFileActivity(token);
      f.workspace.valuationAssumptions.endCollectionFileActivity(token);
    }
    if (kind === "editor-file") {
      f.workspace.valuation.beginDraftFileActivity(token);
      f.workspace.valuation.endDraftFileActivity(token);
    }
    if (kind === "watchlist-file") {
      f.workspace.beginWatchlistDraftFileActivity(token);
      f.workspace.endWatchlistDraftFileActivity(token);
    }
    if (kind === "followups-file") {
      f.workspace.followups.beginDraftFileActivity(token);
      f.workspace.followups.endDraftFileActivity(token);
    }
    if (kind === "navigation-ABA") {
      f.workspace.setView("markets");
      f.workspace.setView("watchlist");
    }
    if (kind === "blocked-ABA") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (kind === "reset") f.group.resetDaily(f.group.getSnapshot());
    if (kind === "session") f.workspace.sessionOwner.dispose();
    expect(capture.current()).toBe(false);
    expect(controller.getSnapshot().report).toBeNull();
    controller.dispose();
  },
);
it("subscriber reentry withdraws the just prepared report before Save", async () => {
  const f = await setup();
  const { controller, deliver } = control(f);
  const stop = controller.subscribe(() => {
    if (controller.getSnapshot().report) f.workspace.setView("markets");
  });
  controller.prepare();
  expect(controller.getSnapshot().report).toBeNull();
  await controller.save();
  expect(deliver).not.toHaveBeenCalled();
  stop();
  controller.dispose();
});
it("cancel and late completion preserve the replacement report and drafts", async () => {
  const f = await setup();
  const { controller, deliver } = control(f);
  let resolve!: (value: TextDocumentDeliveryResult) => void;
  let context!: TextDocumentDeliveryContext;
  deliver.mockImplementation((_doc, c) => {
    context = c;
    return new Promise((r) => {
      resolve = r;
    });
  });
  controller.prepare();
  const before = f.workspace.coordinator.getSnapshot();
  const pending = controller.save();
  expect(context.isCurrent()).toBe(true);
  controller.cancel();
  expect(context.signal.aborted).toBe(true);
  controller.prepare();
  const next = controller.getSnapshot();
  resolve("written");
  await pending;
  expect(controller.getSnapshot()).toBe(next);
  expect(f.workspace.coordinator.getSnapshot()).toBe(before);
  controller.dispose();
});
it("resource replacement aborts delivery and ignores late completion", async () => {
  const f = await setup();
  const { controller, deliver } = control(f);
  let resolve!: (value: TextDocumentDeliveryResult) => void;
  let context!: TextDocumentDeliveryContext;
  deliver.mockImplementation((_doc, c) => {
    context = c;
    return new Promise((r) => {
      resolve = r;
    });
  });
  controller.prepare();
  const pending = controller.save();
  await f.workspace.followups.coordinator.load();
  expect(context.signal.aborted).toBe(true);
  expect(context.isCurrent()).toBe(false);
  resolve("written");
  await pending;
  expect(controller.getSnapshot().report).toBeNull();
  controller.dispose();
});
it("rejects invalid Unicode and whole oversized output before delivery without clipping", async () => {
  expect(watchlistDailyReportHtmlByteLength("\ud800")).toBeNull();
  expect(
    watchlistDailyReportHtmlByteLength(
      "\u00e9".repeat(WATCHLIST_DAILY_REPORT_HTML_MAX_BYTES / 2 + 1),
    ),
  ).toBeNull();
  expect(watchlistDailyReportHtmlByteLength("\ud83d\udcc8")).toBe(4);
  const f = await setup();
  const deliver = vi.fn<WatchlistDailyReportDeliveryAdapter["deliver"]>();
  const controller = new WatchlistDailyReportController(
    f.workspace.getWatchlistDailyReportSource(),
    { deliver },
    () => null,
  );
  controller.prepare();
  await controller.save();
  expect(deliver).not.toHaveBeenCalled();
  controller.dispose();
  expect(
    formatWatchlistDailyReportHtml({} as PreparedWatchlistDailyReport),
  ).toBeNull();
  expect(isPreparedWatchlistDailyReport({})).toBe(false);
});

it("refuses formatter reentry before any destination operation", async () => {
  const f = await setup();
  const { controller, format, deliver } = control(f);
  controller.prepare();
  format.mockImplementation(() => {
    f.workspace.setView("markets");
    return null;
  });
  await controller.save();
  expect(deliver).not.toHaveBeenCalled();
  expect(controller.getSnapshot().report).toBeNull();
  controller.dispose();
});
