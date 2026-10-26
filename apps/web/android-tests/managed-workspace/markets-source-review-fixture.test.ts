import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createFixture } from "./fixture";
import { sourceReviewNote } from "./markets-source-review-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedMarketsSourceReview } from "../../src/clerk-trial/ManagedMarketsSourceReview";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
async function settle() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
async function mounted() {
  const fixture = await createFixture("markets-source-review");
  const controls = fixture.sourceReview;
  if (!controls) throw new Error("Missing invented source-review controls");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("markets");
  await settle();
  return {
    fixture,
    workspace,
    controls,
    review: workspace.marketsSourceReview,
  };
}
type Mounted = Awaited<ReturnType<typeof mounted>>;
function author(f: Mounted) {
  f.workspace.note("listing-zero", sourceReviewNote);
  return f.workspace.coordinator.getSnapshot().draft!;
}
async function firstPass(f: Mounted) {
  f.review.preview();
  await f.review.start();
  expect(f.review.getSnapshot().phase).toBe("complete");
}
async function cancelledPass(f: Mounted) {
  for (const id of ["bls", "bea", "fed"]) f.review.choose(id, true);
  f.review.preview();
  const running = f.review.start();
  await settle();
  expect(f.controls.getSnapshot()).toMatchObject({
    bls: 2,
    bea: 1,
    fed: 1,
    aborted: 0,
    late: 0,
  });
  f.review.cancel();
  expect(f.controls.getSnapshot().aborted).toBe(1);
  f.controls.settleCancelledBls();
  await running;
  await settle();
}
function packets(f: Mounted) {
  return {
    markets: f.workspace.markets.getSnapshot().rows.map((row) => row.response),
    bls: f.workspace.blsCalendar.getSnapshot().calendar,
    bea: f.workspace.agenda.getSnapshot().agenda,
    fed: f.workspace.announcements.getSnapshot().announcements,
  };
}
describe("isolated native Markets source-review protocol", () => {
  it("runs only exact ordered source APIs and preserves captured Load labels and all original clocks", async () => {
    const f = await mounted();
    const draft = author(f);
    expect(f.controls.getSnapshot().order).toEqual([]);
    f.review.preview();
    const plan = f.review.getSnapshot().plan;
    expect(f.controls.getSnapshot().order).toEqual([]);
    expect(plan.map((row) => row.id)).toEqual([
      "price-0",
      "price-1",
      "price-2",
      "bls",
      "bea",
      "fed",
    ]);
    await f.review.start();
    expect(f.controls.getSnapshot()).toEqual({
      order: ["price-0", "price-1", "price-2", "bls", "bea", "fed"],
      prices: 3,
      bls: 1,
      bea: 1,
      fed: 1,
      save: 0,
      aborted: 0,
      late: 0,
    });
    expect(f.review.getSnapshot().plan).toBe(plan);
    expect(plan.every((row) => row.mode === "load")).toBe(true);
    expect(f.review.getSnapshot().rows.map((row) => row.outcome)).toEqual([
      "checked",
      "checked",
      "checked",
      "checked_empty",
      "checked",
      "checked",
    ]);
    const actual = packets(f);
    expect(actual.markets.map((packet) => packet?.security)).toEqual(
      f.fixture.marketsCohort,
    );
    expect(
      actual.markets.every(
        (packet) => packet?.completedAt === "2026-09-20T00:00:01.000Z",
      ),
    ).toBe(true);
    expect(actual.bls).toMatchObject({
      events: [],
      fetchedAt: "2026-10-20T18:00:00.000Z",
    });
    expect(actual.bea?.fetchedAt).toBe("2026-10-21T19:00:00.000Z");
    expect(actual.fed?.fetchedAt).toBe("2026-10-22T20:00:00.000Z");
    expect(actual.fed?.items[1]?.publishedAt).toBeNull();
    expect(f.workspace.markets.getSnapshot().selectedListingId).toBe(
      "listing-alfa",
    );
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      draft,
      dirty: true,
      baseVersion: 1,
    });
  });
  it("fences the cancelled refresh, retains packets through research/Back and saves only the independent full draft", async () => {
    const f = await mounted();
    const draft = author(f);
    await firstPass(f);
    const original = packets(f);
    await cancelledPass(f);
    expect(f.review.getSnapshot().phase).toBe("cancelled");
    expect(f.controls.getSnapshot()).toMatchObject({
      prices: 3,
      bls: 2,
      bea: 1,
      fed: 1,
      save: 0,
      aborted: 1,
      late: 1,
    });
    expect(packets(f)).toEqual(original);
    expect(f.workspace.blsCalendar.getSnapshot().showingPrevious).toBe(true);
    f.workspace.openMarketResearch("eod", "listing-beta-a");
    expect(
      f.workspace.getSnapshot().research?.selection.listing.listingId,
    ).toBe("listing-beta-a");
    expect(f.workspace.eod.getSnapshot().response).toEqual(original.markets[1]);
    expect(f.controls.getSnapshot().prices).toBe(3);
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot().view).toBe("markets");
    expect(packets(f)).toEqual(original);
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(draft);
    f.workspace.setView("watchlist");
    await f.workspace.coordinator.save();
    expect(f.controls.getSnapshot().save).toBe(1);
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      draft,
      baseVersion: 2,
      dirty: false,
    });
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      eod: 0,
      annual: 0,
      filings: 0,
      token: 0,
      signOut: 0,
    });
    expect(() => f.controls.settleCancelledBls()).toThrow(
      "Unexpected invented source-review action",
    );
  });
  it("rejects an out-of-order government request and a wrong exact listing before dispatch", async () => {
    const f = await mounted(),
      signal = new AbortController().signal;
    expect(() => f.fixture.api.blsCalendar(signal)).toThrow(
      "Unexpected invented source-review action",
    );
    expect(() =>
      f.fixture.api.eodHistory(
        {
          catalogSnapshotSha256:
            f.fixture.researchCoverage.catalogSnapshotSha256,
          listingId: "listing-beta-a",
          range: "1m",
        },
        signal,
      ),
    ).toThrow("Unexpected invented source-review action");
    expect(f.controls.getSnapshot().order).toEqual([]);
  });
  it("exposes the native selector contract and complete original plan without starting a read", async () => {
    const f = await mounted();
    f.review.preview();
    const html = load(
      renderToStaticMarkup(
        createElement(ManagedMarketsSourceReview, {
          model: f.review,
          isCurrent: () => true,
        }),
      ),
    );
    expect(html("#managed-markets-source-review").attr("open")).toBeUndefined();
    expect(
      html("#markets-source-review-plan h4")
        .map((_, node) => html(node).text())
        .get(),
    ).toEqual([
      "Load ALFA price history",
      "Load BETA price history",
      "Load BETB price history",
      "Load BLS release calendar",
      "Load BEA release agenda",
      "Load Federal Reserve announcements",
    ]);
    expect(html("#markets-source-review-plan").text()).toContain(
      "class-beta-a",
    );
    expect(html("#markets-source-review-plan").text()).toContain(
      "class-beta-c",
    );
    for (const id of ["preview", "start", "cancel"])
      expect(html(`#markets-source-review-${id}`)).toHaveLength(1);
    expect(f.controls.getSnapshot().order).toEqual([]);
  });
  it("leaves all prior scenarios on their original APIs and has no source-review controls", async () => {
    const original = await createFixture("default");
    expect(original.sourceReview).toBeUndefined();
    await expect(
      original.api.blsCalendar(new AbortController().signal),
    ).rejects.toThrow();
  });
});
