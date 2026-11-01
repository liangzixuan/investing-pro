import { projectPersonalPortfolioLedger } from "@research-cockpit/contracts";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heldDueFixture } from "./test-portfolio-held-due-fixture";
import {
  portfolioScreenLedger,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
import { eodResponse } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { isPreparedPortfolioReviewReport } from "./portfolio-review-report";

const fixtures: Awaited<ReturnType<typeof heldDueFixture>>[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function fixture(loadFollowups = true) {
  const f = await heldDueFixture(true, loadFollowups);
  fixtures.push(f);
  const w = new ManagedWorkspace(
    f.api,
    {
      userId: "dated-user",
      sessionId: "dated-session",
      getToken: vi.fn(),
      signOut: async () => {},
    },
    undefined,
    {
      priceCoverage: portfolioScreenLedger.identities.slice(0, 2),
      researchCoverage: createManagedResearchCoverageFixture(
        portfolioScreenLedger.identities
          .slice(0, 2)
          .map((listing) => ({ listing, cik: "0000000001" })),
      ),
    },
  );
  const dispose = f.dispose;
  f.dispose = () => {
    dispose();
    w.sessionOwner.dispose();
  };
  await w.refreshCatalog();
  await w.portfolio.coordinator.load();
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  if (loadFollowups) await w.followups.coordinator.load();
  w.setView("portfolio");
  f.api.eodHistory = vi.fn<ManagedApi["eodHistory"]>((request) =>
    Promise.resolve({
      ...eodResponse(),
      security: portfolioScreenLedger.identities.find(
        (row) => row.listingId === request.listingId,
      )!,
      window: { startDate: "2026-09-29", endDate: "2026-10-29" },
      rows: [{ date: "2026-10-28", close: "101.125" }],
      requestStartedAt: "2026-10-29T00:00:00.000Z",
      completedAt: "2026-10-29T00:00:01.000Z",
    }),
  );
  const prices = w.createPortfolioCloseReview();
  prices.enter(capturePortfolioCloseContext(w));
  await prices.load();
  return {
    ...f,
    w,
    prices,
    dated: w.portfolioDatedReview,
    intake: w.portfolioHeldDueChecks,
    review: w.followupsReview,
  };
}
function transfer(f: Awaited<ReturnType<typeof fixture>>) {
  expect(
    f.prices.captureReport(new Date().toISOString()),
    JSON.stringify({
      prices: f.prices.getSnapshot(),
      dated: f.dated.getSnapshot(),
    }),
  ).not.toBeNull();
  const reading = f.dated.transfer(f.prices, () => {
    f.w.setView("followups");
    return true;
  });
  expect(reading).not.toBeNull();
  return reading!;
}
function start(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.intake.prepare(f.intake.getSnapshot())).toBe(true);
  const choices = f.intake.getSnapshot().plan.eligible;
  f.intake.choose(f.intake.getSnapshot(), choices[1]!);
  f.intake.choose(f.intake.getSnapshot(), choices[0]!);
  const installed = f.intake.start(f.intake.getSnapshot());
  expect(installed).not.toBeNull();
  return installed!;
}
it("loads Follow-ups separately and transfers a complete owned passive report without starting checks or fetching again", async () => {
  const f = await fixture(false);
  expect(f.dated.getSnapshot().canTransfer).toBe(false);
  await f.dated.loadFollowups(f.dated.getSnapshot());
  expect(f.w.getSnapshot().view).toBe("portfolio");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.dated.getSnapshot().canTransfer).toBe(true);
  // Loading a separate resource does not alter the Portfolio report context.
  f.prices.enter(capturePortfolioCloseContext(f.w));
  await f.prices.load();
  const reads = vi.mocked(f.api.eodHistory).mock.calls.length,
    resolves = vi.mocked(f.api.resolve).mock.calls.length;
  const reading = transfer(f);
  expect(isPreparedPortfolioReviewReport(reading.report)).toBe(true);
  expect(reading.report.ledger).toEqual(portfolioScreenLedger);
  expect(reading.report.sourceRows).toHaveLength(3);
  expect(reading.plan.holdings).toHaveLength(3);
  expect(reading.plan.checks).toHaveLength(3);
  expect(reading.plan.eligible).toHaveLength(2);
  expect(f.intake.getSnapshot().plan).toBe(reading.plan);
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(f.review.getSnapshot().entered).toBe(false);
  expect(f.prices.captureReport(new Date().toISOString())).toBeNull();
  expect(f.api.eodHistory).toHaveBeenCalledTimes(reads);
  expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("retains original clocks and full plan through ordered review, Research Back, authored edits, Complete and Finish", async () => {
  const f = await fixture(),
    reading = transfer(f),
    json = JSON.stringify(reading.report);
  const installed = start(f),
    handles = installed.chosen.map((row) => row.handle);
  expect(f.dated.getSnapshot().phase).toBe("reviewing");
  const entry = f.review.captureCurrent(f.review.getSnapshot())!;
  const prepared = await f.w.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  f.w.openFollowupResearch(prepared!);
  f.w.setNavigationBlocked(true);
  await f.w.setCompanyRoute({
    kind: "company",
    listingId: entry.listing.listingId,
    section: "eod",
  });
  expect(f.dated.getSnapshot().reading).toBe(reading);
  const context = f.w.researchFollowupContext(
    f.w.getSnapshot().research!.selection,
  )!;
  context.editAssessment("Full owned result 東京");
  f.w.setNavigationBlocked(false);
  await f.w.setCompanyRoute(null);
  expect(f.dated.resumeFollowups()).toBe(true);
  expect(f.dated.resumeFollowups()).toBe(false);
  f.w.followups.complete(f.w.followups.currentEntry(entry.id)!, new Date());
  f.review.continue(f.review.getSnapshot());
  f.review.finish(f.review.getSnapshot());
  expect(f.dated.getSnapshot().phase).toBe("finished");
  expect(f.dated.getSnapshot().review?.chosen.map((row) => row.handle)).toEqual(
    handles,
  );
  expect(f.dated.getSnapshot().review?.chosen[0]!.entry.result).toBe(
    "Full owned result 東京",
  );
  expect(f.dated.getSnapshot().reading).toBe(reading);
  expect(JSON.stringify(reading.report)).toBe(json);
  await f.w.followups.coordinator.save();
  expect(f.dated.getSnapshot().reading).toBeNull();
  const fresh = f.makeFresh();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(fresh.portfolioDatedReview.getSnapshot().reading).toBeNull();
  expect(fresh.followups.currentEntry(entry.id)?.result).toBe(
    "Full owned result 東京",
  );
});
it.each([
  "portfolio-form",
  "portfolio-file",
  "followups-file",
  "followups-load",
  "catalog",
  "view-aba",
  "navigation-aba",
  "question",
  "session",
])(
  "permanently retires the reading and only its associated queue after %s",
  async (kind) => {
    const f = await fixture();
    transfer(f);
    start(f);
    const token = {},
      draft = f.w.portfolio.coordinator.getSnapshot().draft!;
    if (kind === "portfolio-form") {
      f.w.portfolio.setPendingEditor(draft, true);
      f.w.portfolio.setPendingEditor(draft, false);
    }
    if (kind === "portfolio-file") {
      f.w.portfolio.beginDraftFileActivity(token);
      f.w.portfolio.endDraftFileActivity(token);
    }
    if (kind === "followups-file") {
      f.w.followups.beginDraftFileActivity(token);
      f.w.followups.endDraftFileActivity(token);
    }
    if (kind === "followups-load") await f.w.followups.coordinator.load();
    if (kind === "catalog") {
      vi.mocked(f.api.status).mockResolvedValue({
        snapshot: { ...portfolioScreenCatalog },
      });
      await f.w.refreshCatalog();
    }
    if (kind === "view-aba") {
      f.w.setView("portfolio");
      f.w.setView("followups");
    }
    if (kind === "navigation-aba") {
      f.w.setNavigationBlocked(true);
      f.w.setNavigationBlocked(false);
    }
    if (kind === "question") {
      const saved = f.w.followups.coordinator.getSnapshot().draft!;
      f.w.followups.coordinator.replaceDraft({
        ...saved,
        entries: saved.entries.map((e, i) =>
          i === 0 ? { ...e, check: "Changed original question" } : e,
        ),
      });
    }
    if (kind === "session") f.w.sessionOwner.dispose();
    expect(f.dated.getSnapshot().reading).toBeNull();
    expect(f.review.getSnapshot().entered).toBe(false);
  },
);
it.each(["false", "throw", "route-aba", "file-aba", "subscriber"])(
  "does not commit a reentrant or unsuccessful transfer: %s",
  async (kind) => {
    const f = await fixture();
    const off = f.dated.subscribe(() => {
      if (kind === "subscriber" && f.dated.getSnapshot().reading)
        f.w.setView("portfolio");
    });
    const action = () =>
      f.dated.transfer(f.prices, () => {
        if (kind === "throw") throw new Error("Navigation failed");
        f.w.setView("followups");
        if (kind === "route-aba") {
          f.w.setView("portfolio");
          f.w.setView("followups");
        }
        if (kind === "file-aba") {
          const token = {};
          f.w.followups.beginDraftFileActivity(token);
          f.w.followups.endDraftFileActivity(token);
        }
        return kind !== "false";
      });
    if (kind === "throw") expect(action).toThrow("Navigation failed");
    else expect(action()).toBeNull();
    off();
    expect(f.dated.getSnapshot().reading).toBeNull();
    expect(f.review.getSnapshot().entered).toBe(false);
  },
);
it("does not associate an unrelated review or resurrect an old report after reentrant Start", async () => {
  const f = await fixture();
  transfer(f);
  f.intake.prepare(f.intake.getSnapshot());
  const entry = f.intake.getSnapshot().plan.eligible[0]!;
  f.intake.choose(f.intake.getSnapshot(), entry);
  let fired = false;
  const off = f.review.subscribe(() => {
    if (!fired && f.review.getSnapshot().phase === "reviewing") {
      fired = true;
      const t = {};
      f.w.followups.beginDraftFileActivity(t);
      f.w.followups.endDraftFileActivity(t);
    }
  });
  expect(f.intake.start(f.intake.getSnapshot())).toBeNull();
  off();
  expect(f.dated.getSnapshot().reading).toBeNull();
  expect(f.review.getSnapshot().entered).toBe(false);
});

it("retains per-share-class Filings through Inspect and ignores a cancelled late refresh without changing original report clocks", async () => {
  const f = await fixture(),
    reading = transfer(f);
  start(f);
  const filings = f.w.reviewFilings,
    selected = filings.getSnapshot().selected!;
  const packet = filingsResponse(2, "available", selected.filings.selection!);
  f.api.recentFilings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValueOnce(packet);
  await filings.load(filings.getSnapshot());
  const retained = filings.getSnapshot().selected!.filings.response;
  const capture = await f.w.prepareReviewFilingsResearch(filings.getSnapshot());
  expect(capture).not.toBeNull();
  f.w.openFollowupResearch(capture!);
  expect(f.w.filings.getSnapshot().responseOrigin).toBe("followups-review");
  expect(f.dated.getSnapshot().reading).toBe(reading);
  f.w.closeResearch();
  expect(filings.getSnapshot().selected!.filings.response).toBe(retained);
  let settle!: (value: typeof packet) => void;
  vi.mocked(f.api.recentFilings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  const refresh = filings.load(filings.getSnapshot());
  filings.cancel(filings.getSnapshot());
  settle({ ...packet, completedAt: packet.completedAt });
  await refresh;
  expect(filings.getSnapshot().selected!.filings.response).toBe(retained);
  expect(f.dated.getSnapshot().reading).toBe(reading);
  f.review.continue(f.review.getSnapshot());
  expect(filings.getSnapshot().selected!.filings.response).toBeNull();
  expect(filings.getSnapshot().rows[0]!.filings.response).toBe(retained);
  expect(f.api.recentFilings).toHaveBeenCalledTimes(2);
  expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("does not let a foreign close model or a valid report for a different ledger transfer", async () => {
  const f = await fixture(),
    other = await fixture(),
    navigate = vi.fn(() => true);
  expect(f.dated.transfer(other.prices, navigate)).toBeNull();
  const original = f.w.portfolio.coordinator.getSnapshot().draft!.ledger!;
  const wrong = {
    ...original,
    opening: { ...original.opening, cashUsd: "999.00" },
  };
  const projection = projectPersonalPortfolioLedger(wrong);
  expect(projection.status).toBe("valid");
  if (projection.status !== "valid") throw new Error("Invalid invented ledger");
  f.prices.enter({
    ledger: wrong,
    portfolio: projection.portfolio,
    current: () => true,
  });
  await f.prices.load();
  expect(f.prices.captureReport(new Date().toISOString())).not.toBeNull();
  expect(f.dated.transfer(f.prices, navigate)).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});
it("keeps the reading on zero-choice Start and refuses a nested transfer from a synchronous subscriber", async () => {
  const f = await fixture();
  let nested: unknown = "not called",
    once = false;
  const off = f.dated.subscribe(() => {
    if (!once) {
      once = true;
      nested = f.dated.transfer(f.prices, () => {
        throw new Error("Nested navigation");
      });
    }
  });
  const reading = transfer(f);
  off();
  expect(nested).toBeNull();
  f.intake.prepare(f.intake.getSnapshot());
  expect(f.intake.start(f.intake.getSnapshot())).toBeNull();
  expect(f.dated.getSnapshot().reading).toBe(reading);
  expect(f.review.getSnapshot().entered).toBe(false);
});
it("cannot revive a reading or Research from a late identity resolution after a file round trip", async () => {
  const f = await fixture();
  transfer(f);
  start(f);
  const entry = f.review.captureCurrent(f.review.getSnapshot())!;
  let settle!: (value: Awaited<ReturnType<ManagedApi["resolve"]>>) => void;
  vi.mocked(f.api.resolve).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  const pending = f.w.prepareFollowupResearch(entry);
  const token = {};
  f.w.followups.beginDraftFileActivity(token);
  f.w.followups.endDraftFileActivity(token);
  settle({
    snapshotSha256: entry.catalogSnapshotSha256,
    results: [{ listingId: entry.listing.listingId, listing: entry.listing }],
  });
  expect(await pending).toBeNull();
  expect(f.dated.getSnapshot().reading).toBeNull();
  expect(f.w.getSnapshot().research).toBeNull();
});
it("retains current finished results but retires the original reading when another held set starts", async () => {
  const f = await fixture(),
    reading = transfer(f);
  start(f);
  f.review.finish(f.review.getSnapshot());
  expect(f.dated.getSnapshot().reading).toBe(reading);
  expect(f.intake.prepare(f.intake.getSnapshot())).toBe(true);
  f.intake.choose(
    f.intake.getSnapshot(),
    f.intake.getSnapshot().plan.eligible[0]!,
  );
  expect(f.intake.start(f.intake.getSnapshot())).not.toBeNull();
  expect(f.dated.getSnapshot().reading).toBeNull();
  expect(f.review.getSnapshot().entered).toBe(true);
});

it("does not let an ordinary route publication mint a nested dated transfer", async () => {
  const f = await fixture();
  let called = false;
  const off = f.dated.subscribe(() => {
    if (!called) {
      called = true;
      f.dated.transfer(f.prices, () => {
        f.w.setView("followups");
        return true;
      });
    }
  });
  f.w.setView("followups");
  off();
  expect(f.dated.getSnapshot().reading).toBeNull();
});

it("refuses an unobserved close date without loading or navigating", async () => {
  const f = await fixture(),
    prices = f.w.createPortfolioCloseReview();
  prices.enter(capturePortfolioCloseContext(f.w));
  const calls = vi.mocked(f.api.eodHistory).mock.calls.length,
    navigate = vi.fn(() => true);
  expect(f.dated.transfer(prices, navigate)).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(f.api.eodHistory).toHaveBeenCalledTimes(calls);
});
it("a consumed Research Back allowance does not authorize later navigation cancellation", async () => {
  const f = await fixture();
  transfer(f);
  start(f);
  const capture = await f.w.prepareFollowupResearch(
    f.review.getSnapshot().selected!.entry,
  );
  f.w.openFollowupResearch(capture!);
  f.w.closeResearch();
  expect(f.dated.resumeFollowups()).toBe(true);
  f.w.setNavigationBlocked(true);
  f.w.setNavigationBlocked(false);
  expect(f.dated.getSnapshot().reading).toBeNull();
  expect(f.review.getSnapshot().entered).toBe(false);
});
