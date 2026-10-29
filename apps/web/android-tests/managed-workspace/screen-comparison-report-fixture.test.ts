import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ScreenComparisonReportSnapshot } from "../../src/clerk-trial/ScreenComparisonReportSnapshot";
import { ScreenComparisonReportController } from "../../src/clerk-trial/screen-comparison-report-controller";
import { createFixture } from "./fixture";
import { screenComparisonReportClocks } from "./screen-comparison-report-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers();
  const fixture = await createFixture("screen-comparison-report");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      financialScreenListingIds: fixture.screenComparison!.listingIds,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("discover");
  return { fixture, workspace, screen: workspace.financialScreen };
}
async function selectPair(f: Awaited<ReturnType<typeof setup>>) {
  await f.screen.loadUniverse(f.screen.getSnapshot());
  f.screen.stageCriteria(f.screen.getSnapshot());
  f.screen.setCriteria(f.screen.getSnapshot(), {
    clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
    sort: { field: "symbol", direction: "asc" },
  });
  const running = f.screen.run(f.screen.getSnapshot());
  await vi.waitFor(() => expect(f.fixture.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await running;
  const state = f.screen.getSnapshot();
  const left = state.run!.rows.find(
    (row) => row.member.listing.listingId === "listing-zero",
  )!;
  const right = state.run!.rows.find(
    (row) => row.member.listing.listingId === "listing-one",
  )!;
  f.screen.selectComparison(state, "left", left);
  f.screen.selectComparison(f.screen.getSnapshot(), "right", right);
  return { left, right };
}
function expectNoUnrelatedEffects(f: Awaited<ReturnType<typeof setup>>) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 1,
    status: 1,
    marketsResolve: 1,
    resolve: 1,
    annual: 2,
    save: 0,
    eod: 0,
    filings: 0,
    search: 0,
    calendar: 0,
    fed: 0,
    token: 0,
    signOut: 0,
  });
  expect(
    Object.values(f.fixture.screenComparisonReport!.getSnapshot()),
  ).toEqual(Array(10).fill(0));
}
function expectCompleteCompany(
  $: ReturnType<typeof load>,
  side: "left" | "right",
  period: string,
) {
  const section = $(`section[aria-label='${side} company']`);
  expect(section.find("table")).toHaveLength(3);
  expect(
    section
      .find("[aria-label$='reported USD table']")
      .map((_, el) => $(el).attr("aria-label"))
      .get(),
  ).toEqual([
    "Income statement reported USD table",
    "Balance sheet reported USD table",
    "Cash flow reported USD table",
  ]);
  expect(section.text()).toContain(period);
  expect(section.text()).toContain(screenComparisonReportClocks[side]);
  expect(section.text()).toContain("Class A");
  expect(section.text()).toContain("XNAS");
}

describe("invented native complete screening comparison report fixture", () => {
  it("captures all three complete statement groups with independent exact identities, periods and source clocks", async () => {
    const f = await setup();
    expect(
      f.screen.captureComparisonReport("2026-10-29T00:00:00.000Z"),
    ).toBeNull();
    await selectPair(f);
    const capture = f.screen.captureComparisonReport(
      "2026-10-29T00:00:00.000Z",
    )!;
    const report = capture.report;
    expect(report.kind).toBe("screen_comparison");
    expect(report.criteria).toEqual(f.screen.getSnapshot().run!.criteria);
    expect(report.run.status).toBe("completed");
    expect(report.catalogSnapshotSha256).toBe(`sha256:${"a".repeat(64)}`);
    expect(report.left.listing.listingId).toBe("listing-zero");
    expect(report.right.listing.listingId).toBe("listing-one");
    expect(report.left.response.evidence.generation.cutoffAt).toBe(
      screenComparisonReportClocks.left,
    );
    expect(report.right.response.evidence.generation.cutoffAt).toBe(
      screenComparisonReportClocks.right,
    );
    const $ = load(
      renderToStaticMarkup(
        createElement(ScreenComparisonReportSnapshot, { report }),
      ),
    );
    expectCompleteCompany($, "left", "2025-12-31");
    expectCompleteCompany($, "right", "2025-06-30");
    expect($.root().text()).toContain("USD -200.125");
    expect($.root().text()).toContain("USD 0");
    expect($.root().text()).toContain("Unavailable");
    expect(JSON.parse($("article > details > pre").text())).toEqual(report);
    expectNoUnrelatedEffects(f);
  });

  it("withdraws a real captured source on navigation and keeps the pair and complete unsaved Watchlist through Research and Back", async () => {
    const f = await setup();
    f.workspace.setView("watchlist");
    f.workspace.note(
      "listing-zero",
      "Private draft Café 東京 📈 <script>kept</script>",
    );
    const draft = f.workspace.coordinator.getSnapshot().draft;
    f.workspace.setView("discover");
    const { right } = await selectPair(f);
    const state = f.screen.getSnapshot();
    const capture = f.screen.captureComparisonReport(
      "2026-10-29T00:00:00.000Z",
    )!;
    expect(JSON.stringify(capture.report)).not.toContain("Private draft");
    const response = right.report!.response!;
    f.workspace.openFinancialScreenReport({
      run: state.run!,
      row: right,
      response,
    });
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    expect(capture.current()).toBe(false);
    f.workspace.closeResearch();
    expect(capture.current()).toBe(false);
    expect(f.screen.getSnapshot().comparison).toBe(state.comparison);
    expect(f.screen.getSnapshot().run).toBe(state.run);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(
      f.screen.captureComparisonReport("2026-10-29T00:00:01.000Z"),
    ).not.toBeNull();
    expectNoUnrelatedEffects(f);
  });

  it("aborts a pending delivery on pair retirement and ignores its late result without writing a replacement state", async () => {
    const f = await setup();
    await selectPair(f);
    let finish: ((value: "written") => void) | undefined;
    let pending: { signal: AbortSignal; isCurrent: () => boolean } | undefined;
    const controller = new ScreenComparisonReportController(
      {
        capture: () =>
          f.screen.captureComparisonReport("2026-10-29T00:00:00.000Z"),
        subscribe: f.screen.subscribe,
      },
      {
        deliver: (_document, context) => {
          pending = context;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
      () => ({
        purpose: "investment.screen-comparison-html",
        filename: "invented.html",
        text: "invented controller-only bytes",
        byteLength: 30,
      }),
    );
    controller.prepare();
    const saving = controller.save();
    expect(controller.getSnapshot().saving).toBe(true);
    f.screen.selectComparison(f.screen.getSnapshot(), "right", null);
    expect(pending!.signal.aborted).toBe(true);
    expect(pending!.isCurrent()).toBe(false);
    expect(controller.getSnapshot().report).toBeNull();
    const retired = controller.getSnapshot();
    finish!("written");
    await saving;
    expect(controller.getSnapshot()).toBe(retired);
    expectNoUnrelatedEffects(f);
    controller.dispose();
  });
});
