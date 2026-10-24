import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { capturePortfolioCloseContext } from "../../src/clerk-trial/portfolio-close-review-context";
import { createFixture } from "./fixture";
import { portfolioCloseFixturePacket } from "./portfolio-close-fixture";
import {
  eodRequest,
  eodSelection,
} from "../../src/clerk-trial/eod-history-fixture";

afterEach(() => vi.useRealTimers());
async function authorHolding(
  w: ManagedWorkspace,
  identity: Awaited<ReturnType<typeof createFixture>>["priceCoverage"][number],
) {
  await w.refreshCatalog();
  await w.portfolio.coordinator.load();
  w.setView("portfolio");
  w.portfolio.start("2026-10-01", "948.00");
  // Invented authored input uses the existing whole-ledger replace and catalog review.
  const draft = w.portfolio.coordinator.getSnapshot().draft!;
  w.portfolio.replace(draft, {
    ...draft.ledger!,
    identities: [identity],
    opening: {
      ...draft.ledger!.opening,
      holdings: [
        {
          listingId: identity.listingId,
          shares: "1",
          totalCostBasisUsd: "100.50",
          confirmedOn: "2026-10-01",
        },
      ],
    },
  });
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
}

async function cancelLateRefresh(
  f: Awaited<ReturnType<typeof createFixture>>,
  w: ManagedWorkspace,
  review: ReturnType<ManagedWorkspace["createPortfolioCloseReview"]>,
  before: object,
) {
  const source = review.getSnapshot().rows[0]!.response;
  const held = review.load();
  review.cancel();
  f.settleCancelledEod();
  await held;
  expect(review.getSnapshot().rows[0]).toMatchObject({
    response: source,
    showingPrevious: true,
  });
  expect(w.portfolio.coordinator.getSnapshot()).toBe(before);
  expect(f.getSnapshot()).toMatchObject({
    eod: 2,
    eodAborted: 1,
    eodLateResolved: 1,
    save: 0,
    annual: 0,
    filings: 0,
  });
  expect(f.portfolio!.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
}

describe("invented native Portfolio close journey", () => {
  it("owns dated raw packets and refuses mismatched requests", () => {
    const packet = portfolioCloseFixturePacket(
      eodRequest(),
      eodSelection.listing,
      Date.parse("2026-10-23T12:00:00.000Z"),
    );
    expect(packet.rows).toEqual([
      { date: "2026-10-21", close: "100.25" },
      { date: "2026-10-23", close: "110.25" },
    ]);
    expect(() =>
      portfolioCloseFixturePacket(eodRequest("1y"), eodSelection.listing),
    ).toThrow();
  });
  it("uses the real workspace, selected-day valuation, cancel/late refusal and no resource Save", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
    const f = await createFixture("portfolio-close-review");
    const w = new ManagedWorkspace(f.api, f.session, undefined, {
      priceCoverage: f.priceCoverage,
      researchCoverage: f.researchCoverage,
    });
    try {
      await authorHolding(w, f.priceCoverage[0]!);
      const context = capturePortfolioCloseContext(w);
      expect(context).not.toBeNull();
      const before = w.portfolio.coordinator.getSnapshot();
      const review = w.createPortfolioCloseReview();
      review.enter(context);
      await review.load();
      expect(
        review.getSnapshot().rows[0]?.response,
        JSON.stringify(review.getSnapshot()),
      ).not.toBeNull();
      expect(review.review()).toMatchObject({
        asOfDate: "2026-10-23",
        holdingsValueUsd: "110.25",
        totalValueUsd: "1058.25",
      });
      await cancelLateRefresh(f, w, review, before);
      review.retire();
    } finally {
      w.sessionOwner.dispose();
    }
  });
});
