import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { WatchlistDailyReportController } from "../../src/clerk-trial/watchlist-daily-report-controller";
import { formatWatchlistDailyReportHtml } from "../../src/clerk-trial/watchlist-daily-report-html";
import { createFixture } from "./fixture";
import { createNativeWatchlistDailyReportFixture } from "./native-watchlist-daily-report-fixture";

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function passive<T extends { readonly member: { readonly listing: unknown } }>(
  row: T,
) {
  return { ...row, member: { listing: row.member.listing } };
}
async function finished() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
  const fixture = await createFixture("watchlist-daily-report");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
    },
  );
  workspace.setView("watchlist");
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  const group = workspace.filingsReview;
  for (const member of group.getSnapshot().memberships)
    group.choose(group.getSnapshot(), member);
  group.startDaily(group.getSnapshot());
  const plan = group.prepareDaily(group.getSnapshot(), ["price"]);
  expect(plan).not.toBeNull();
  await group.runDaily(group.getSnapshot(), plan!);
  await workspace.valuationAssumptions.coordinator.load();
  const scenarios = workspace.watchlistValuationReview;
  scenarios.preview(scenarios.getSnapshot());
  scenarios.evaluate(scenarios.getSnapshot());
  group.finishDaily(group.getSnapshot());
  return { fixture, workspace, group, scenarios };
}
it("keeps complete partial evidence and six outcomes through real formatting, cancelled choice and exact HTML delivery without resource effects", async () => {
  vi.stubGlobal("document", {
    implementation: { createHTMLDocument: documentBoundary },
  });
  const x = await finished();
  const written: string[] = [];
  let choices = 0;
  const native = createNativeWatchlistDailyReportFixture({
    choose: () =>
      Promise.resolve(
        ++choices === 1
          ? { status: "cancelled" }
          : {
              status: "chosen",
              handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            },
      ),
    write: ({ text }) => {
      written.push(text);
      return Promise.resolve({ status: "written" });
    },
    cancel: () => Promise.resolve(),
  });
  const source = x.workspace.getWatchlistDailyReportSource();
  const controller = new WatchlistDailyReportController(
    source,
    native.delivery,
    formatWatchlistDailyReportHtml,
  );
  try {
    const counts = x.fixture.watchlistSavedScenario!.getSnapshot();
    const states = [
      x.workspace.coordinator.getSnapshot(),
      x.workspace.followups.coordinator.getSnapshot(),
      x.workspace.valuationAssumptions.coordinator.getSnapshot(),
    ];
    controller.prepare();
    const report = controller.getSnapshot().report;
    expect(report).not.toBeNull();
    expect(report!.rows.map((r) => r.evidence.member.listing.symbol)).toEqual([
      "GOOGL",
      "GOOG",
      "AAPL",
    ]);
    expect(report!.rows.map((r) => r.evidence)).toEqual(
      x.group.getSnapshot().rows.map(passive),
    );
    const daily = x.group.getSnapshot().daily!;
    expect(report!.daily).toEqual({
      ...daily,
      plan: daily.plan && {
        names: daily.plan.names,
        rows: daily.plan.rows.map(passive),
      },
      outcomes: daily.outcomes.map(passive),
    });
    expect(report!.scenarios!.outcomes).toEqual(
      x.scenarios.getSnapshot().reading!.rows,
    );
    expect(
      report!
        .scenarios!.outcomes!.slice(0, 2)
        .map((r) => r.comparison!.rows.length),
    ).toEqual([6, 6]);
    expect(report!.scenarios!.rows[2]!.reason).toBe("missing_saved_inputs");
    expect(report!.scenarios!.rows[1]!.entry!.exit.inputs.baseRevenue).toBe(
      "unfinished 1..",
    );
    expect(report!.resources.followups.latestLoaded).toBe(false);
    await controller.save();
    expect(controller.getSnapshot().report).toBe(report);
    expect(written).toEqual([]);
    expect(native.getSnapshot()).toMatchObject({
      choices: 1,
      writeRequests: 0,
      writes: 0,
    });
    await controller.save();
    expect(written).toHaveLength(1);
    const html = load(written[0]!);
    expect(
      JSON.parse(html('[data-watchlist-daily-report-payload="true"]').text()),
    ).toEqual(report);
    expect(
      html("script,img,iframe,form,button,input,select,object"),
    ).toHaveLength(0);
    expect(native.getSnapshot().byteLength).toBe(
      new TextEncoder().encode(written[0]).byteLength,
    );
    expect(x.fixture.watchlistSavedScenario!.getSnapshot()).toEqual(counts);
    expect([
      x.workspace.coordinator.getSnapshot(),
      x.workspace.followups.coordinator.getSnapshot(),
      x.workspace.valuationAssumptions.coordinator.getSnapshot(),
    ]).toEqual(states);
  } finally {
    controller.dispose();
    x.workspace.sessionOwner.dispose();
  }
});
it("refuses a retained report after a note edit and does not write or resurrect equal-looking content", async () => {
  vi.stubGlobal("document", {
    implementation: { createHTMLDocument: documentBoundary },
  });
  const x = await finished();
  let writes = 0;
  const controller = new WatchlistDailyReportController(
    x.workspace.getWatchlistDailyReportSource(),
    {
      deliver: () => {
        writes++;
        return Promise.resolve("written");
      },
    },
    formatWatchlistDailyReportHtml,
  );
  try {
    controller.prepare();
    expect(controller.getSnapshot().report).not.toBeNull();
    const member = x.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    x.workspace.note(member.listingId, "Changed authored note");
    x.workspace.note(member.listingId, member.note);
    expect(controller.getSnapshot().report).toBeNull();
    await controller.save();
    expect(writes).toBe(0);
  } finally {
    controller.dispose();
    x.workspace.sessionOwner.dispose();
  }
});
