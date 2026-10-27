import { load as parseHtml } from "cheerio";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import {
  compositionDueOn,
  compositionExpected,
  compositionLedger,
  compositionQuestion,
} from "./portfolio-composition-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { capturePortfolioCloseContext } from "../../src/clerk-trial/portfolio-close-review-context";
import { prepareHoldingFollowup } from "../../src/clerk-trial/managed-holding-followup";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortfolioReviewReportSnapshot } from "../../src/clerk-trial/PortfolioReviewReportSnapshot";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function workspaceFor(fixture: Fixture, fresh = false) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.portfolio!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  workspaces.push(workspace);
  return workspace;
}
async function loadComposition() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T12:00:00.000Z"));
  const fixture = await createFixture("portfolio-composition-review");
  const workspace = workspaceFor(fixture);
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  workspace.setView("portfolio");
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  const context = capturePortfolioCloseContext(workspace);
  expect(context).not.toBeNull();
  const prices = workspace.createPortfolioCloseReview();
  prices.enter(context);
  expect(prices.review()).toBeNull();
  await prices.load();
  expect(
    prices.getSnapshot().rows.every((row) => row.response !== null),
    JSON.stringify(prices.getSnapshot()),
  ).toBe(true);
  return { fixture, workspace, prices };
}
const expectedComposition = {
  status: "available",
  reason: null,
  totalValueUsd: "200.00",
  cashUsd: "100.00",
  cashPercent: "50.00",
  holdings: [
    { listingId: "listing-zero", valueUsd: "50.00", percent: "25.00" },
    { listingId: "listing-zero-c", valueUsd: "50.00", percent: "25.00" },
  ],
  method: "displayed_usd_cents_over_complete_total_percent_half_up_2dp",
};
function noIndependentWrites(fixture: Fixture, sessions = 1) {
  expect(fixture.getSnapshot()).toMatchObject({
    status: sessions,
    marketsResolve: sessions,
    resolve: 1,
    eod: 2,
    load: 0,
    save: 0,
    portfolioSave: 0,
    annual: 0,
    filings: 0,
    search: 0,
    calendar: 0,
    fed: 0,
    marketsEod: 0,
    token: 0,
    signOut: 0,
  });
  expect(fixture.portfolio!.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    commits: 0,
    replays: 0,
  });
}
describe("invented native complete Portfolio composition", () => {
  it("retains two exact classes, dated source packets, complete denominator and the whole report appendix", async () => {
    const { fixture, workspace, prices } = await loadComposition();
    expect(prices.review()!.composition).toEqual(expectedComposition);
    const capture = prices.captureReport("2026-10-27T12:00:05.000Z")!;
    expect(capture.report.review.composition).toEqual(expectedComposition);
    expect(capture.report.ledger).toEqual(compositionLedger(fixture).payload);
    expect(
      capture.report.sourceRows.map((row) => row.response!.security.listingId),
    ).toEqual(["listing-zero", "listing-zero-c"]);
    for (const row of capture.report.sourceRows)
      expect(row.response).toMatchObject({
        requestStartedAt: "2026-10-27T11:59:58.000Z",
        completedAt: "2026-10-27T11:59:59.000Z",
        priceBasis: "raw_close",
        provider: "Tiingo",
      });
    const html = renderToStaticMarkup(
      createElement(PortfolioReviewReportSnapshot, { report: capture.report }),
    );
    expect(html).toContain("25.00%");
    expect(html).toContain("50.00%");
    expect(parseHtml(html)("pre").text()).toBe(
      JSON.stringify(capture.report, null, 2),
    );
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    noIndependentWrites(fixture);
    prices.retire();
  });
  it("keeps Class C research/question/date through Back and independent Save/fresh Load without changing the original ledger", async () => {
    const { fixture, workspace, prices } = await loadComposition();
    const original = workspace.portfolio.coordinator.getSnapshot().draft!;
    const capture = prices.captureReport("2026-10-27T12:00:05.000Z")!;
    const identity = original.ledger!.identities[1]!;
    workspace.openPortfolioResearch(original, identity);
    const selection = workspace.getSnapshot().research!.selection;
    expect(selection.listing.listingId).toBe("listing-zero-c");
    expect(workspace.getHoldingResearchPosition(selection)).toMatchObject({
      shares: "1",
      totalCostBasisUsd: null,
      confirmedOn: "2026-10-03",
      listing: identity,
    });
    await workspace.loadHoldingFollowups(selection, () => true);
    const context = workspace.captureHoldingFollowup(selection);
    expect(context.reason).toBeNull();
    const preview = prepareHoldingFollowup(
      context.port!,
      compositionQuestion,
      compositionDueOn,
      () => true,
    ).preview!;
    expect(preview.check).toBe(compositionQuestion);
    expect(preview.dueOn).toBe(compositionDueOn);
    const created = preview.create()!;
    expect(created).not.toBeNull();
    expect(preview.create()).toBeNull();
    expect(capture.current()).toBe(false);
    expect(workspace.portfolio.coordinator.getSnapshot().draft).toBe(original);
    workspace.closeResearch();
    workspace.setView("followups");
    await workspace.followups.coordinator.save();
    const expected = compositionExpected(fixture, created.id);
    expect(workspace.followups.coordinator.getSnapshot().saved).toEqual({
      version: 2,
      payload: expected,
    });
    workspace.sessionOwner.dispose();
    const fresh = workspaceFor(fixture, true);
    await fresh.refreshCatalog();
    expect(fresh.coordinator.getSnapshot().draft).toBeNull();
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    await fresh.followups.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
      draft: expected,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 2,
      save: 1,
      commits: 1,
      replays: 0,
    });
    noIndependentWrites(fixture, 2);
    prices.retire();
  });
});
