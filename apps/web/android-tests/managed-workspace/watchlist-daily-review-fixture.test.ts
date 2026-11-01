import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareFilingsFollowup } from "../../src/clerk-trial/managed-filings-followup";
import { prepareFilingsAssessment } from "../../src/clerk-trial/managed-filings-assessment";
import { createFixture } from "./fixture";
import {
  dailyDueOn,
  dailyQuestion,
  dailyQuestionCheck,
  dailyReviewExpected,
} from "./watchlist-daily-review-fixture-data";
import {
  reviewFilingsIds,
  reviewFilingsRaw,
  reviewFilingsResult,
} from "./review-filings-evidence-fixture-data";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
  const f = await createFixture("watchlist-daily-review"),
    meta = f.watchlistDailyReview!;
  const options = {
    researchCoverage: f.researchCoverage,
    priceCoverage: f.priceCoverage,
    marketsCohort: f.marketsCohort,
  };
  const w = new ManagedWorkspace(f.api, f.session, undefined, options);
  w.setView("watchlist");
  await w.refreshCatalog();
  expect(w.coordinator.getSnapshot().draft).toBeNull();
  await w.coordinator.load();
  const m = w.filingsReview;
  for (const id of [
    reviewFilingsIds.googl,
    reviewFilingsIds.goog,
    reviewFilingsIds.mismatch,
  ])
    m.choose(
      m.getSnapshot(),
      m.getSnapshot().memberships.find((row) => row.listing.listingId === id)!,
    );
  m.startDaily(m.getSnapshot());
  return { f, meta, w, m, options };
}
async function run(x: Awaited<ReturnType<typeof setup>>) {
  const plan = x.m.prepareDaily(x.m.getSnapshot(), ["price", "filings"]);
  expect(plan).not.toBeNull();
  await x.m.runDaily(x.m.getSnapshot(), plan!);
}
it("keeps ordered partial reads through explicit continuation, paired Research/Back, complete authored checks, Finish and separate Save/fresh Load", async () => {
  const x = await setup(),
    { f, meta, w, m } = x;
  let fresh: ManagedWorkspace | undefined;
  try {
    const originalWatchlist = w.coordinator.getSnapshot();
    const first = m.prepareDaily(m.getSnapshot(), ["price"]);
    expect(
      first!.rows
        .filter((r) => r.source === "filings")
        .map((r) => r.disposition),
    ).toEqual(["not-selected", "not-selected", "not-selected"]);
    expect(meta.getSnapshot()).toMatchObject({ eod: 0, filings: 0 });
    await run(x);
    expect(m.getSnapshot().daily!.outcomes.map((r) => r.status)).toEqual([
      "loaded",
      "loaded",
      "failed",
      "unattempted",
      "unsupported",
      "unsupported",
    ]);
    expect(meta.getSnapshot()).toMatchObject({
      eod: 2,
      filings: 1,
      active: 0,
      maxActive: 1,
    });
    const googl = m.getSnapshot().rows[0]!,
      firstPrice = googl.price!.response,
      firstFilings = googl.filings.response;
    await run(x);
    expect(m.getSnapshot().daily!.outcomes.map((r) => r.status)).toEqual([
      "retained",
      "retained",
      "loaded",
      "loaded",
      "unsupported",
      "unsupported",
    ]);
    expect(m.getSnapshot().rows[0]!.price!.response).toBe(firstPrice);
    expect(m.getSnapshot().rows[0]!.filings.response).toBe(firstFilings);
    await run(x);
    expect(m.getSnapshot().daily!.outcomes.map((r) => r.status)).toEqual([
      "retained",
      "retained",
      "retained",
      "retained",
      "unsupported",
      "unsupported",
    ]);
    expect(meta.getSnapshot()).toMatchObject({
      eod: 3,
      filings: 2,
      maxActive: 1,
      rejected: 0,
    });
    for (const index of [0, 1]) {
      const row = m.getSnapshot().rows[index]!;
      m.select(m.getSnapshot(), row.member);
      const capture = m.captureDaily(m.getSnapshot())!;
      expect(w.canOpenWatchlistDailyReview(capture)).toBe(true);
      w.openWatchlistDailyReview(capture);
      const selection = w.getSnapshot().research!.selection;
      w.setNavigationBlocked(true);
      await w.setCompanyRoute({
        kind: "company",
        listingId: selection.listing.listingId,
        section: "filings",
      });
      w.setNavigationBlocked(false);
      expect(w.eod.getSnapshot().response).toEqual(row.price!.response);
      expect(w.filings.getSnapshot().response).toEqual(row.filings.response);
      expect(selection.listing.symbol).toBe(index === 0 ? "GOOGL" : "GOOG");
      w.switchToEod();
      w.setNavigationBlocked(true);
      await w.setCompanyRoute({
        kind: "company",
        listingId: selection.listing.listingId,
        section: "eod",
      });
      w.setNavigationBlocked(false);
      expect(w.eod.getSnapshot().response).toEqual(row.price!.response);
      w.switchToFilings();
      w.setNavigationBlocked(true);
      await w.setCompanyRoute({
        kind: "company",
        listingId: selection.listing.listingId,
        section: "filings",
      });
      w.setNavigationBlocked(false);
      expect(m.getSnapshot().selected).toBe(row.member);
      expect(w.filings.getSnapshot().response).toEqual(row.filings.response);
      if (index === 0) {
        await w.getCompanyResearchChecks(selection)!.followups.load();
        const entry = w.followups.currentEntry(
          meta.data.original.entries[1]!.id,
        )!;
        const context = w.getCompanyResearchChecks(selection)!;
        expect(context.followups.value).toBe(entry);
        expect(context.attach(meta.data.original.entries[0]!)).toBeNull();
        expect(
          w.getCompanyResearchChecks(selection)!.attach(entry)?.entry,
        ).toBe(entry);
        w.researchFollowupContext(selection)!.editAssessment(
          reviewFilingsRaw[1]!,
        );
        const currentPacket = w.filings.getSnapshot().response!;
        const port = w.captureFilingsAssessment(selection, currentPacket).port!;
        expect(port).not.toBeNull();
        const prepared = prepareFilingsAssessment(
          port,
          currentPacket.issuer.filings[0]!,
          () => true,
        );
        expect(prepared.preview!.result).toBe(reviewFilingsResult(1));
        expect(prepared.preview!.apply()).toBe(true);
        expect(w.followups.currentEntry(entry.id)!.status).toBe("open");
      } else {
        const response = w.filings.getSnapshot().response!,
          filing = response.issuer.filings[0]!;
        const port = w.captureFilingsFollowup(
          selection,
          response,
          filing,
        ).port!;
        const prepared = prepareFilingsFollowup(
          port,
          dailyQuestion,
          dailyDueOn,
          () => true,
        );
        expect(prepared.reason).toBeNull();
        const preview = prepared.preview!;
        expect(preview.check).toBe(dailyQuestionCheck);
        expect(
          w.followups.coordinator.getSnapshot().draft!.entries,
        ).toHaveLength(7);
        expect(preview.create()?.status).toBe("open");
      }
      w.setNavigationBlocked(true);
      await w.setCompanyRoute(null);
      w.setNavigationBlocked(false);
      expect(m.getSnapshot().selected).toBe(row.member);
      expect(m.getSnapshot().rows[index]!.price!.response).toBe(
        row.price!.response,
      );
      expect(m.getSnapshot().rows[index]!.filings.response).toBe(
        row.filings.response,
      );
      expect(w.coordinator.getSnapshot()).toBe(originalWatchlist);
      expect(meta.getSnapshot()).toMatchObject({
        eod: 3,
        filings: 2,
        rejected: 0,
      });
    }
    m.finishDaily(m.getSnapshot());
    expect(m.getSnapshot().daily!.phase).toBe("finished");
    expect(m.captureDaily(m.getSnapshot())).toBeNull();
    expect(m.getSnapshot().chosen.map((row) => row.listing.symbol)).toEqual([
      "GOOGL",
      "GOOG",
      "NVDA",
    ]);
    const draft = w.followups.coordinator.getSnapshot().draft!,
      expected = dailyReviewExpected(
        meta.data.original,
        meta.day,
        draft.entries.at(-1)!.id,
      );
    expect(draft).toEqual(expected);
    expect(f.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    await w.followups.coordinator.save();
    expect(f.followups!.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
    w.sessionOwner.dispose();
    fresh = new ManagedWorkspace(
      f.api,
      f.followups!.nextSession(),
      undefined,
      x.options,
    );
    fresh.setView("watchlist");
    await fresh.refreshCatalog();
    await fresh.followups.coordinator.load();
    await fresh.coordinator.load();
    expect(
      encodeResearchFollowupsPayload(
        fresh.followups.coordinator.getSnapshot().draft!,
      ),
    ).toBe(encodeResearchFollowupsPayload(expected));
    expect(fresh.coordinator.getSnapshot().draft).toEqual(meta.data.watchlist);
    expect(fresh.filingsReview.getSnapshot().daily).toBeNull();
    expect(fresh.eod.getSnapshot().response).toBeNull();
    expect(meta.getSnapshot()).toEqual({
      status: 2,
      load: 2,
      eod: 3,
      filings: 2,
      active: 0,
      maxActive: 1,
      requests: [
        "GOOGL:price",
        "GOOGL:filings",
        "GOOG:price",
        "GOOG:price",
        "GOOG:filings",
      ],
      rejected: 0,
      unexpected: {},
    });
  } finally {
    w.sessionOwner.dispose();
    fresh?.sessionOwner.dispose();
  }
});
it.each([
  "unsupported",
  "foreign-catalog",
  "out-of-order",
  "aborted",
  "concurrent",
])("refuses %s source authority", async (kind) => {
  const x = await setup();
  const signal = new AbortController();
  const request = {
    listingId: reviewFilingsIds.googl as string,
    catalogSnapshotSha256: x.f.researchCoverage.catalogSnapshotSha256,
    range: "1m" as const,
  };
  if (kind === "unsupported") request.listingId = reviewFilingsIds.mismatch;
  if (kind === "foreign-catalog")
    request.catalogSnapshotSha256 = `sha256:${"f".repeat(64)}`;
  if (kind === "out-of-order") request.listingId = reviewFilingsIds.goog;
  if (kind === "aborted") signal.abort();
  try {
    if (kind === "concurrent") {
      const first = x.f.api.eodHistory(request, signal.signal);
      await expect(x.f.api.eodHistory(request, signal.signal)).rejects.toThrow(
        "Unexpected invented",
      );
      await first;
    } else
      await expect(x.f.api.eodHistory(request, signal.signal)).rejects.toThrow(
        "Unexpected invented",
      );
    expect(x.meta.getSnapshot().rejected).toBe(1);
    expect(x.f.followups!.getSnapshot().commits).toBe(0);
  } finally {
    x.w.sessionOwner.dispose();
  }
});
it("refuses an unrelated operation and a premature Save without changing saved content", async () => {
  const x = await setup(),
    signal = new AbortController().signal;
  try {
    await expect(
      x.f.api.saveFollowups(
        {
          expectedVersion: 7,
          idempotencyKey: "50000000-0000-4000-8000-000000000001",
          payload: x.meta.data.original,
        },
        signal,
      ),
    ).rejects.toThrow("Unexpected invented");
    await expect(x.f.api.loadPortfolio(signal)).rejects.toThrow(
      "Unexpected invented",
    );
    expect(x.f.followups!.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
  } finally {
    x.w.sessionOwner.dispose();
  }
});
