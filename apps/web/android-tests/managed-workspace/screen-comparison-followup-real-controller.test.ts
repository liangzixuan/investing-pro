import { afterEach, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ScreenComparisonFollowupReview } from "../../src/clerk-trial/use-screen-comparison-followup-state";
import { createFixture } from "./fixture";
import {
  comparisonFollowupQuestion,
  comparisonFollowupDueOn,
  comparisonFollowupNote,
} from "./screen-comparison-followup-fixture-data";

let close: (() => void) | null = null;
afterEach(() => {
  close?.();
  close = null;
  vi.useRealTimers();
});

async function createControllerFixture() {
  const fixture = await createFixture("screen-comparison-followup");
  const w = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
    researchCoverage: fixture.researchCoverage,
    marketsCohort: fixture.marketsCohort,
    priceCoverage: fixture.priceCoverage,
    financialScreenListingIds: fixture.screenComparison!.listingIds,
  });
  const props = {
    workspace: w,
    routeActive: () =>
      w.getSnapshot().view === "discover" &&
      !w.getSnapshot().research &&
      !w.getSnapshot().companyRoute,
    navigationPending: false,
    onReview: vi.fn(),
  };
  const review = new ScreenComparisonFollowupReview(props);
  review.mount();
  review.commit({}, props);
  close = () => {
    review.dispose();
    w.sessionOwner.dispose();
  };
  return { fixture, w, review };
}

type ControllerFixture = Awaited<ReturnType<typeof createControllerFixture>>;

async function settleComparisonPair({ fixture, w }: ControllerFixture) {
  await w.coordinator.load();
  await w.refreshCatalog();
  w.setView("watchlist");
  w.note("listing-zero", comparisonFollowupNote);
  w.setView("discover");
  const screen = w.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.stageCriteria(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), {
    clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
    sort: { field: "symbol", direction: "asc" },
  });
  const running = screen.run(screen.getSnapshot());
  await vi.waitFor(() => expect(fixture.getSnapshot().annual).toBe(1));
  await vi.advanceTimersByTimeAsync(20000);
  await running;
  const rows = screen.getSnapshot().run!.rows;
  screen.selectComparison(
    screen.getSnapshot(),
    "left",
    rows.find((r) => r.member.listing.listingId === "listing-zero")!,
  );
  screen.selectComparison(
    screen.getSnapshot(),
    "right",
    rows.find((r) => r.member.listing.listingId === "listing-one")!,
  );
}

function collectInitialLoadTrace({ fixture, w, review }: ControllerFixture) {
  const trace: unknown[] = [];
  const observe = () => {
    const s = review.getSnapshot(),
      saved = w.followups.coordinator.getSnapshot();
    if (trace.length < 64)
      trace.push({
        open: s.open,
        side: s.side,
        question: s.question,
        dueOn: s.dueOn,
        capturePresent: s.capture !== null,
        captureCurrent: s.capture?.isCurrent(),
        loading: s.loading,
        formMessage: s.message,
        canLoad: review.canLoad(),
        canPrepare: review.canPrepare(),
        destinations: review.destinations().map((d) => [d.side, d.eligible]),
        phase: saved.phase,
        baseVersion: saved.baseVersion,
        entries: saved.draft?.entries.length ?? null,
        dirty: saved.dirty,
        followupsMessage: saved.message,
        calls: fixture.followups!.getSnapshot().load,
      });
  };
  const release = review.subscribe(observe);
  observe();
  return { trace, observe, release };
}

it("retains the captured source and authored form through real initial Follow-ups load publications", async () => {
  vi.useFakeTimers();
  const { fixture, w, review } = await createControllerFixture();
  await settleComparisonPair({ fixture, w, review });
  review.setOpen(true);
  review.capture();
  review.edit("side", "right");
  review.edit("question", comparisonFollowupQuestion);
  review.edit("dueOn", comparisonFollowupDueOn);
  const captured = review.getSnapshot().capture;
  expect(captured).not.toBeNull();
  expect(review.canLoad()).toBe(true);
  const { trace, observe, release } = collectInitialLoadTrace({
    fixture,
    w,
    review,
  });
  try {
    await review.load();
    observe();
    expect(review.getSnapshot(), JSON.stringify(trace)).toMatchObject({
      capture: captured,
      side: "right",
      question: comparisonFollowupQuestion,
      dueOn: comparisonFollowupDueOn,
      loading: false,
    });
    expect(captured!.isCurrent(), JSON.stringify(trace)).toBe(true);
    expect(
      w.followups.coordinator.getSnapshot(),
      JSON.stringify(trace),
    ).toMatchObject({ baseVersion: 1, dirty: false, phase: "idle" });
    expect(
      w.followups.coordinator.getSnapshot().draft!.entries,
      JSON.stringify(trace),
    ).toHaveLength(2);
    expect(review.canPrepare(), JSON.stringify(trace)).toBe(true);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 2,
      resolve: 1,
      save: 0,
    });
    expect(fixture.screenComparisonFollowup!.getSnapshot().rejected).toBe(0);
  } finally {
    release();
  }
});
