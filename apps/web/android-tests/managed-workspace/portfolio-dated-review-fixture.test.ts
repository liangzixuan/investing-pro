import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { capturePortfolioCloseContext } from "../../src/clerk-trial/portfolio-close-review-context";
import { afterEach, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import {
  reviewFilingsIds,
  reviewFilingsResult,
} from "./review-filings-evidence-fixture-data";
import { datedReviewExpected } from "./portfolio-dated-review-fixture-data";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const f = await createFixture("portfolio-dated-review"),
    signal = new AbortController().signal;
  const m = f.portfolioDatedReview!,
    digest = f.researchCoverage.catalogSnapshotSha256;
  await f.api.status(signal);
  await f.api.loadPortfolio(signal);
  await f.api.loadFollowups(signal);
  const held = m.ledger.payload.identities;
  await f.api.resolve(
    { snapshotSha256: digest, listingIds: held.map((x) => x.listingId) },
    signal,
  );
  return { f, m, signal, digest };
}
async function closes(x: Awaited<ReturnType<typeof setup>>) {
  const packets = [];
  for (const security of x.f.priceCoverage) {
    const request = {
      catalogSnapshotSha256: x.digest,
      listingId: security.listingId,
      range: "1m" as const,
    };
    const packet = await x.f.api.eodHistory(request, x.signal);
    expect(parseManagedEodHistoryResponse(packet, request)).toEqual(packet);
    packets.push(packet);
  }
  return packets;
}
it("admits four serial exact holding histories with an older observed day, missing-day and unsupported holdings", async () => {
  const x = await setup();
  expect(x.m.getSnapshot()).toMatchObject({ eod: 0, filings: 0, resolve: 1 });
  const packets = await closes(x);
  expect(x.m.closeDate).toBe("2026-10-30");
  expect(packets.map((p) => p.security.symbol)).toEqual([
    "GOOG",
    "GOOGL",
    "AAPL",
    "MSFT",
  ]);
  expect(
    packets.map((p) => p.rows.some((r) => r.date === x.m.closeDate)),
  ).toEqual([true, true, true, false]);
  expect(x.m.ledger.payload.opening.holdings).toHaveLength(7);
  expect(x.m.getSnapshot()).toMatchObject({
    eod: 4,
    activeEod: 0,
    maxActiveEod: 1,
    filings: 0,
    rejected: 0,
  });
  expect(x.f.followups!.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
});
it("keeps reversed chosen share classes distinct, admits only two exact packets and saves the complete mixed-status oracle separately", async () => {
  const x = await setup();
  await closes(x);
  for (const index of [1, 0]) {
    const original = x.m.packets[index]!;
    const packet = await x.f.api.recentFilings(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: x.digest,
        listingId: original.security.listingId,
        symbol: original.security.symbol,
      },
      x.signal,
    );
    expect(packet).toEqual(original);
    await x.f.api.resolve(
      { snapshotSha256: x.digest, listingIds: [original.security.listingId] },
      x.signal,
    );
  }
  const expected = datedReviewExpected(x.m.original, x.m.day);
  expect(expected.entries[0]).toMatchObject({
    status: "open",
    completedOn: null,
    result: reviewFilingsResult(0),
  });
  expect(expected.entries[1]).toMatchObject({
    status: "completed",
    completedOn: x.m.day,
    result: reviewFilingsResult(1),
  });
  expect(expected.entries.slice(2)).toEqual(x.m.original.entries.slice(2));
  expect(x.m.getSnapshot()).toMatchObject({
    status: 1,
    portfolioLoad: 1,
    resolve: 3,
    eod: 4,
    filings: 2,
    rejected: 0,
  });
  expect(x.f.followups!.getSnapshot().save).toBe(0);
  await x.f.api.saveFollowups(
    {
      expectedVersion: 7,
      idempotencyKey: "50000000-0000-4000-8000-000000000001",
      payload: expected,
    },
    x.signal,
  );
  expect(x.f.followups!.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
  x.f.followups!.nextSession();
  await x.f.api.status(x.signal);
  const restored = await x.f.api.loadFollowups(x.signal);
  expect(restored.version).toBe(8);
  expect(encodeResearchFollowupsPayload(restored.payload)).toBe(
    encodeResearchFollowupsPayload(expected),
  );
  expect(await x.f.api.loadPortfolio(x.signal)).toEqual(x.m.ledger);
  expect(x.m.getSnapshot()).toMatchObject({
    status: 2,
    portfolioLoad: 2,
    resolve: 3,
    eod: 4,
    filings: 2,
    rejected: 0,
  });
});
it.each(["unsupported", "foreign-digest", "duplicate", "concurrent"])(
  "refuses %s close authority without expanding the fixture budget",
  async (kind) => {
    const x = await setup();
    const request = {
      catalogSnapshotSha256: x.digest,
      listingId: reviewFilingsIds.goog as string,
      range: "1m" as const,
    };
    if (kind === "unsupported") request.listingId = reviewFilingsIds.mismatch;
    if (kind === "foreign-digest")
      request.catalogSnapshotSha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "duplicate") await x.f.api.eodHistory(request, x.signal);
    if (kind === "concurrent") {
      const first = x.f.api.eodHistory(request, x.signal);
      await expect(
        x.f.api.eodHistory(
          { ...request, listingId: reviewFilingsIds.googl },
          x.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
      await first;
    } else
      await expect(x.f.api.eodHistory(request, x.signal)).rejects.toThrow(
        "Unexpected invented",
      );
    expect(x.m.getSnapshot().rejected).toBe(1);
    expect(x.f.followups!.getSnapshot().commits).toBe(0);
  },
);
it("rejects a source-free or wrong complete Save and every unrelated provider call", async () => {
  for (const operation of ["save", "markets"]) {
    const x = await setup();
    if (operation === "save")
      await expect(
        x.f.api.saveFollowups(
          {
            expectedVersion: 7,
            idempotencyKey: "50000000-0000-4000-8000-000000000002",
            payload: x.m.original,
          },
          x.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    else
      await expect(
        x.f.api.resolve(
          {
            snapshotSha256: x.digest,
            listingIds: x.f.marketsCohort.map((r) => r.listingId),
          },
          x.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    expect(x.m.getSnapshot().rejected).toBe(1);
    expect(x.f.followups!.getSnapshot().save).toBe(0);
  }
});

it("carries the exact complete reading through both real selected Filings routes, Finish, separate Save and fresh Load with exact counters", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const f = await createFixture("portfolio-dated-review"),
    meta = f.portfolioDatedReview!;
  const options = {
    researchCoverage: f.researchCoverage,
    priceCoverage: f.priceCoverage,
    marketsCohort: f.marketsCohort,
  };
  const w = new ManagedWorkspace(f.api, f.session, undefined, options),
    owners = [w];
  try {
    w.setView("portfolio");
    await w.refreshCatalog();
    await w.portfolio.coordinator.load();
    await w.portfolio.reviewCatalog();
    w.portfolio.applyReview();
    await w.portfolioDatedReview.loadFollowups(
      w.portfolioDatedReview.getSnapshot(),
    );
    const originalPortfolio = w.portfolio.coordinator.getSnapshot(),
      watchlist = w.coordinator.getSnapshot();
    const prices = w.createPortfolioCloseReview();
    prices.enter(capturePortfolioCloseContext(w));
    await prices.load();
    prices.selectDate(meta.closeDate);
    const reading = w.portfolioDatedReview.transfer(
      prices,
      () => {
        w.setView("followups");
        return true;
      },
      "2026-11-01T12:00:02.000Z",
    );
    expect(reading).not.toBeNull();
    const full = JSON.stringify(reading!.report);
    expect(reading!.report.review).toMatchObject({
      asOfDate: "2026-10-30",
      pricedHoldings: 3,
      totalHoldings: 7,
      pricedHoldingsSubtotalUsd: "290.63",
      holdingsValueUsd: null,
      totalValueUsd: null,
    });
    expect(reading!.report.sourceRows).toHaveLength(7);
    expect(reading!.report.ledger).toEqual(meta.ledger.payload);
    const intake = w.portfolioHeldDueChecks;
    expect(intake.prepare(intake.getSnapshot())).toBe(true);
    for (const index of [1, 0])
      intake.choose(
        intake.getSnapshot(),
        w.followups.currentEntry(meta.original.entries[index]!.id)!,
      );
    const started = intake.start(intake.getSnapshot())!;
    expect(started.chosen.map((r) => r.entry.id)).toEqual([
      meta.original.entries[1]!.id,
      meta.original.entries[0]!.id,
    ]);
    const handles = started.chosen.map((r) => r.handle);
    for (const [position, index] of [1, 0].entries()) {
      await w.reviewFilings.load(w.reviewFilings.getSnapshot());
      const packet = w.reviewFilings.getSnapshot().selected!.filings.response!;
      expect(packet).toEqual(meta.packets[index]);
      const prepared = await w.prepareReviewFilingsResearch(
        w.reviewFilings.getSnapshot(),
      );
      expect(prepared).not.toBeNull();
      w.openFollowupResearch(prepared!);
      w.setNavigationBlocked(true);
      await w.setCompanyRoute({
        kind: "company",
        listingId: packet.security.listingId,
        section: "filings",
      });
      expect(w.filings.getSnapshot().responseOrigin).toBe("followups-review");
      expect(w.filings.getSnapshot().response).toEqual(packet);
      expect(w.portfolioDatedReview.getSnapshot().reading).toBe(reading);
      w.researchFollowupContext(
        w.getSnapshot().research!.selection,
      )!.editAssessment(reviewFilingsResult(index));
      w.setNavigationBlocked(false);
      await w.setCompanyRoute(null);
      expect(w.portfolioDatedReview.resumeFollowups()).toBe(true);
      expect(w.reviewFilings.getSnapshot().selected!.filings.response).toBe(
        packet,
      );
      const entry = () =>
        w.followups.currentEntry(meta.original.entries[index]!.id)!;
      w.followups.complete(entry(), new Date());
      expect(w.followupsReview.getSnapshot().position).toBe(position);
      w.followups.reopen(entry());
      if (position === 0) {
        w.followups.complete(entry(), new Date());
        w.followupsReview.continue(w.followupsReview.getSnapshot());
      }
      expect(w.portfolioDatedReview.getSnapshot().reading).toBe(reading);
      expect(JSON.stringify(reading!.report)).toBe(full);
      expect(w.portfolio.coordinator.getSnapshot()).toBe(originalPortfolio);
      expect(w.coordinator.getSnapshot()).toBe(watchlist);
    }
    w.followupsReview.finish(w.followupsReview.getSnapshot());
    expect(w.portfolioDatedReview.getSnapshot().phase).toBe("finished");
    expect(w.followupsReview.getSnapshot().chosen.map((r) => r.handle)).toEqual(
      handles,
    );
    const expected = datedReviewExpected(meta.original, meta.day);
    expect(w.followups.coordinator.getSnapshot().draft).toEqual(expected);
    expect(meta.getSnapshot()).toMatchObject({
      status: 1,
      portfolioLoad: 1,
      resolve: 3,
      eod: 4,
      filings: 2,
      activeEod: 0,
      maxActiveEod: 1,
      rejected: 0,
    });
    expect(f.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    await w.followups.coordinator.save();
    expect(f.followups!.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
    expect(w.portfolioDatedReview.getSnapshot().reading).toBeNull();
    w.sessionOwner.dispose();
    const fresh = new ManagedWorkspace(
      f.api,
      f.followups!.nextSession(),
      undefined,
      options,
    );
    owners.push(fresh);
    fresh.setView("followups");
    await fresh.refreshCatalog();
    await fresh.followups.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(expected);
    expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
    expect(fresh.portfolioDatedReview.getSnapshot().reading).toBeNull();
    expect(fresh.reviewFilings.getSnapshot().rows).toEqual([]);
    await fresh.portfolio.coordinator.load();
    expect(fresh.portfolio.coordinator.getSnapshot().draft!.ledger).toEqual(
      meta.ledger.payload,
    );
    fresh.setView("portfolio");
    await fresh.portfolio.reviewCatalog();
    fresh.portfolio.applyReview();
    expect(meta.getSnapshot()).toMatchObject({
      status: 2,
      portfolioLoad: 2,
      resolve: 4,
      eod: 4,
      filings: 2,
      rejected: 0,
      unexpected: {},
    });
    expect(f.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      annual: 0,
      search: 0,
      calendar: 0,
      fed: 0,
      marketsResolve: 0,
      token: 0,
      signOut: 0,
    });
  } finally {
    owners.forEach((owner) => owner.sessionOwner.dispose());
  }
});
