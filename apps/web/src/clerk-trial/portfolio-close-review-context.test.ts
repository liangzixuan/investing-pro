import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedEodCooldownError } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
const listing = eodSelection.listing;
const digest = eodSelection.catalogSnapshotSha256;
const other = { ...listing, listingId: "listing-other", symbol: "OTHER" };
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-portfolio-watchlist",
  catalogVersion: "one",
  asOf: "2026-09-01T00:00:00.000Z",
  acquiredAt: "2026-09-01T00:00:00.000Z",
  generatedAt: "2026-09-01T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
const ledger: ManagedPortfolioPayload = {
  schemaVersion: 3,
  name: "My Portfolio",
  currency: "USD",
  snapshotSha256: digest,
  basisMethod: "fifo_with_opening_pool",
  identities: [listing],
  opening: {
    asOfDate: "2026-09-01",
    cashUsd: "100.00",
    holdings: [
      {
        listingId: listing.listingId,
        shares: "2.000000",
        totalCostBasisUsd: "80.00",
        confirmedOn: "2026-09-01",
      },
    ],
  },
  transactions: [],
};
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture(value = ledger, approve = true) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  let saved: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: [{ ...other, note: "Saved separate research" }],
  };
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected source or resource request")),
  );
  const api = {
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    load: vi.fn<ManagedApi["load"]>(() =>
      Promise.resolve({ version: 1, payload: structuredClone(saved) }),
    ),
    save: vi.fn<ManagedApi["save"]>((command) => {
      saved = structuredClone(command.payload);
      return Promise.resolve({
        version: command.expectedVersion + 1,
        payload: saved,
        replayed: false,
      });
    }),
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockResolvedValue({ version: 1, payload: value }),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing,
        })),
      }),
    ),
    savePortfolio: vi.fn<ManagedApi["savePortfolio"]>(() =>
      Promise.reject(new Error("Unexpected Portfolio Save")),
    ),
    loadFollowups: unexpected,
    saveFollowups: unexpected,
    loadValuationAssumptions: unexpected,
    saveValuationAssumptions: unexpected,
    search: unexpected,
    annualReport: unexpected,
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse()),
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    blsCalendar: unexpected,
    economicCalendar: unexpected,
  } satisfies ManagedApi;
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented-portfolio-user",
      sessionId: "invented-portfolio-session",
      getToken: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
    undefined,
    { priceCoverage: [listing] },
  );
  owners.push(workspace);
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  workspace.setView("portfolio");
  if (approve) {
    await workspace.portfolio.reviewCatalog();
    workspace.portfolio.applyReview();
  }
  vi.clearAllMocks();
  return { workspace, api, unexpected, saved: () => saved };
}

describe("Portfolio close review workspace capability", () => {
  it("requires current Portfolio load and identity approval independently of Watchlist", async () => {
    const f = await fixture(ledger, false);
    expect(capturePortfolioCloseContext(f.workspace)).toBeNull();
    await f.workspace.portfolio.reviewCatalog();
    f.workspace.portfolio.applyReview();
    const context = capturePortfolioCloseContext(f.workspace);
    expect(context?.current()).toBe(true);
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.load).not.toHaveBeenCalled();
    const prices = f.workspace.createPortfolioCloseReview();
    prices.enter(context);
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    const before = f.workspace.portfolio.coordinator.getSnapshot();
    await prices.load();
    expect(prices.review()).toMatchObject({
      pricedHoldings: 1,
      holdingsValueUsd: "203.00",
      totalValueUsd: "303.00",
    });
    expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(before);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
    prices.retire();
  });
  it.each([
    "navigation",
    "route",
    "portfolio",
    "catalog",
    "session",
    "editor",
    "review",
  ] as const)(
    "expires captured data and callbacks after %s changes and restoration",
    async (change) => {
      const f = await fixture();
      const w = f.workspace;
      const context = capturePortfolioCloseContext(w)!;
      expect(context).not.toBeNull();
      const prices = w.createPortfolioCloseReview();
      prices.enter(context);
      await prices.load();
      const draft = w.portfolio.coordinator.getSnapshot().draft!;
      if (change === "navigation") {
        w.setNavigationBlocked(true);
        expect(capturePortfolioCloseContext(w)).toBeNull();
        w.setNavigationBlocked(false);
      } else if (change === "route") {
        w.setView("watchlist");
        w.setView("portfolio");
      } else if (change === "portfolio") {
        w.portfolio.replace(draft, {
          ...draft.ledger!,
          opening: { ...draft.ledger!.opening, cashUsd: "99.00" },
        });
        w.portfolio.coordinator.replaceDraft(draft);
      } else if (change === "catalog") await w.refreshCatalog();
      else if (change === "session") w.sessionOwner.retire("Invented expiry");
      else if (change === "editor") {
        w.portfolio.setPendingEditor(draft, true);
        expect(capturePortfolioCloseContext(w)).toBeNull();
        w.portfolio.setPendingEditor(draft, false);
      } else {
        await w.portfolio.reviewCatalog();
        expect(capturePortfolioCloseContext(w)).toBeNull();
        w.portfolio.cancelReview();
      }
      expect(context.current()).toBe(false);
      expect(prices.review()).toBeNull();
      const calls = f.api.eodHistory.mock.calls.length;
      await prices.load();
      expect(f.api.eodHistory).toHaveBeenCalledTimes(calls);
      prices.retire();
    },
  );
  it("opens exact held-company Research and returns without altering the ledger or loading sources", async () => {
    const f = await fixture(),
      w = f.workspace;
    const before = w.portfolio.coordinator.getSnapshot();
    const context = capturePortfolioCloseContext(w)!;
    const draft = before.draft!;
    w.openPortfolioResearch(draft, draft.ledger!.identities[0]!);
    expect(w.getSnapshot().research?.selection.origin).toBe("portfolio");
    expect(context.current()).toBe(false);
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
    w.closeResearch();
    expect(w.getSnapshot().view).toBe("portfolio");
    expect(w.portfolio.coordinator.getSnapshot()).toBe(before);
    expect(capturePortfolioCloseContext(w)?.current()).toBe(true);
    expect(context.current()).toBe(false);
  });
  it("shares company cooldown with the Portfolio factory without making a second request", async () => {
    const f = await fixture(),
      w = f.workspace;
    const context = capturePortfolioCloseContext(w)!;
    const prices = w.createPortfolioCloseReview();
    prices.enter(context);
    f.api.eodHistory.mockRejectedValueOnce(
      new ManagedEodCooldownError("2026-10-23T12:01:00.000Z"),
    );
    await prices.load();
    const draft = w.portfolio.coordinator.getSnapshot().draft!;
    w.openPortfolioResearch(draft, draft.ledger!.identities[0]!);
    await w.eod.load();
    expect(f.api.eodHistory).toHaveBeenCalledTimes(1);
    expect(w.eod.getSnapshot().message).toContain("12:01:00");
    prices.retire();
  });
  it.each(["conflict", "commit_unknown"] as const)(
    "pauses close review during %s recovery without another source request",
    async (code) => {
      const f = await fixture(),
        w = f.workspace;
      const context = capturePortfolioCloseContext(w)!;
      const review = w.createPortfolioCloseReview();
      review.enter(context);
      await review.load();
      f.api.savePortfolio.mockRejectedValueOnce(new TrialApiError(code));
      await w.portfolio.coordinator.save();
      expect(
        w.portfolio.coordinator.getSnapshot()[
          code === "conflict" ? "conflict" : "uncertain"
        ],
      ).toBe(true);
      expect(capturePortfolioCloseContext(w)).toBeNull();
      expect(context.current()).toBe(false);
      expect(review.review()).toBeNull();
      await review.load();
      expect(f.api.eodHistory).toHaveBeenCalledTimes(1);
      review.retire();
    },
  );
  it("refuses a held close when an explicit independent Save starts and finishes", async () => {
    const f = await fixture(),
      w = f.workspace;
    const context = capturePortfolioCloseContext(w)!;
    let finishRead!: (value: ReturnType<typeof eodResponse>) => void;
    f.api.eodHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    const review = w.createPortfolioCloseReview();
    review.enter(context);
    const loading = review.load();
    let finishSave!: () => void;
    f.api.savePortfolio.mockImplementationOnce(
      (command) =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve({ version: 2, payload: command.payload, replayed: false });
        }),
    );
    const saving = w.portfolio.coordinator.save();
    expect(capturePortfolioCloseContext(w)).toBeNull();
    expect(context.current()).toBe(false);
    finishSave();
    await saving;
    finishRead(eodResponse());
    await loading;
    expect(context.current()).toBe(false);
    expect(review.getSnapshot().rows).toEqual([]);
    expect(f.api.eodHistory).toHaveBeenCalledTimes(1);
    review.retire();
  });
});
