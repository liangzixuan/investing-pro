import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import {
  applyPortfolioWatchlist,
  isPortfolioWatchlistCurrent,
  preparePortfolioWatchlist,
  type PortfolioWatchlistPreview,
} from "./managed-portfolio-watchlist";

const listing = eodSelection.listing;
const digest = eodSelection.catalogSnapshotSha256;
const other = { ...listing, listingId: "listing-other", symbol: "OTHER" };
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-portfolio-watchlist",
  catalogVersion: "one",
  asOf: "2026-10-01T00:00:00.000Z",
  acquiredAt: "2026-10-01T00:00:00.000Z",
  generatedAt: "2026-10-01T00:00:00.000Z",
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
    asOfDate: "2026-10-01",
    cashUsd: "100.00",
    holdings: [
      {
        listingId: listing.listingId,
        shares: "2.000000",
        totalCostBasisUsd: "80.00",
        confirmedOn: "2026-10-01",
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
    cpiHeadlines: vi
      .fn<ManagedApi["cpiHeadlines"]>()
      .mockRejectedValue(new Error("Unexpected CPI headlines read")),
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
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
    savePortfolio: unexpected,
    loadFollowups: unexpected,
    saveFollowups: unexpected,
    loadValuationAssumptions: unexpected,
    saveValuationAssumptions: unexpected,
    search: unexpected,
    annualReport: unexpected,
    eodHistory: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    blsCalendar: unexpected,
    economicCalendar: unexpected,
  } satisfies ManagedApi;
  const workspace = new ManagedWorkspace(api, {
    userId: "invented-portfolio-user",
    sessionId: "invented-portfolio-session",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  });
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  workspace.setView("portfolio");
  if (approve) {
    await workspace.portfolio.reviewCatalog();
    workspace.portfolio.applyReview();
  }
  workspace.note(other.listingId, "Unsaved café 東京 research");
  vi.clearAllMocks();
  return { workspace, api, unexpected, saved: () => saved };
}
function review(workspace: ManagedWorkspace) {
  const result = preparePortfolioWatchlist(workspace, listing.listingId);
  expect(result.reason).toBe("");
  expect(result.preview).not.toBeNull();
  return result.preview!;
}
function refuse(
  workspace: ManagedWorkspace,
  preview: PortfolioWatchlistPreview,
) {
  const before = workspace.coordinator.getSnapshot();
  expect(isPortfolioWatchlistCurrent(workspace, preview)).toBe(false);
  expect(applyPortfolioWatchlist(workspace, preview).added).toBe(false);
  expect(workspace.coordinator.getSnapshot()).toBe(before);
}

describe("Portfolio holding to Watchlist draft", () => {
  it("reviews full current identity and authored holding; appends once, then saves separately", async () => {
    const f = await fixture();
    const portfolio = f.workspace.portfolio.coordinator.getSnapshot();
    const before = f.workspace.coordinator.getSnapshot();
    const preview = review(f.workspace);
    expect(preview).toEqual({
      listing,
      status: "add",
      shares: "2",
      confirmedOn: "2026-10-01",
    });
    expect(f.workspace.coordinator.getSnapshot()).toBe(before);
    expect(Object.isFrozen(preview.listing)).toBe(true);
    expect(applyPortfolioWatchlist(f.workspace, preview).added).toBe(true);
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...other, note: "Unsaved café 東京 research" },
      { ...listing, note: "" },
    ]);
    expect(f.saved().memberships).toEqual([
      { ...other, note: "Saved separate research" },
    ]);
    expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
    refuse(f.workspace, preview);
    expect(f.api.load).not.toHaveBeenCalled();
    expect(f.api.loadPortfolio).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.status).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledTimes(1);
    expect(f.saved().memberships).toHaveLength(2);
    expect(f.workspace.coordinator.getSnapshot().dirty).toBe(false);
  });

  it("preserves an existing exact listing's note and order without notifying", async () => {
    const { workspace } = await fixture();
    const draft = workspace.coordinator.getSnapshot().draft!;
    workspace.coordinator.replaceDraft({
      ...draft,
      memberships: [
        { ...listing, note: "Keep this thesis" },
        ...draft.memberships,
      ],
    });
    const preview = review(workspace);
    expect(preview.status).toBe("existing");
    const before = workspace.coordinator.getSnapshot();
    const listener = vi.fn();
    workspace.coordinator.subscribe(listener);
    expect(applyPortfolioWatchlist(workspace, preview)).toMatchObject({
      added: false,
    });
    expect(workspace.coordinator.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    refuse(workspace, preview);
  });

  it("refuses rebound identity, duplicate listing IDs and invalid existing notes", async () => {
    const { workspace } = await fixture();
    const draft = workspace.coordinator.getSnapshot().draft!;
    for (const memberships of [
      [{ ...listing, securityId: "different-security", note: "" }],
      [
        { ...other, note: "" },
        { ...other, note: "" },
      ],
      [{ ...other, note: "invalid\nraw note" }],
    ]) {
      workspace.coordinator.replaceDraft({ ...draft, memberships });
      const before = workspace.coordinator.getSnapshot();
      expect(
        preparePortfolioWatchlist(workspace, listing.listingId).preview,
      ).toBeNull();
      expect(workspace.coordinator.getSnapshot()).toBe(before);
    }
  });

  it("checks the complete draft byte and entry limits", async () => {
    const { workspace } = await fixture();
    const draft = workspace.coordinator.getSnapshot().draft!;
    for (const memberships of [
      Array.from({ length: 130 }, (_, i) => ({
        ...other,
        listingId: `entry-${i}`,
        note: "é".repeat(2000),
      })),
      Array.from({ length: 10_000 }, (_, i) => ({
        ...other,
        listingId: `entry-${i}`,
        note: "",
      })),
    ]) {
      workspace.coordinator.replaceDraft({ ...draft, memberships });
      expect(
        preparePortfolioWatchlist(workspace, listing.listingId).preview,
      ).toBeNull();
    }
  });

  it("rejects registered but closed positions and invalid projected ledgers", async () => {
    const f = await fixture({
      ...ledger,
      opening: { ...ledger.opening, holdings: [] },
    });
    expect(
      preparePortfolioWatchlist(f.workspace, listing.listingId).preview,
    ).toBeNull();
    const current = f.workspace.portfolio.coordinator.getSnapshot().draft!;
    f.workspace.portfolio.replace(current, {
      ...ledger,
      transactions: [
        {
          id: "oversell",
          type: "sell",
          date: "2026-10-02",
          listingId: listing.listingId,
          shares: "3.000000",
          grossUsd: "40.00",
          feeUsd: "0.00",
        },
      ],
    });
    expect(
      preparePortfolioWatchlist(f.workspace, listing.listingId).preview,
    ).toBeNull();
    expect(
      preparePortfolioWatchlist(f.workspace, "unknown-listing").preview,
    ).toBeNull();
  });

  it("requires the existing explicit Portfolio identity approval", async () => {
    const { workspace, api } = await fixture(ledger, false);
    expect(
      preparePortfolioWatchlist(workspace, listing.listingId).reason,
    ).toContain("identities");
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it.each(["watchlist", "portfolio"] as const)(
    "refuses busy, stale and unsettled %s baselines",
    async (resource) => {
      const { workspace } = await fixture();
      const coordinator =
        resource === "watchlist"
          ? workspace.coordinator
          : workspace.portfolio.coordinator;
      const original = coordinator.getSnapshot();
      const getSnapshot = vi.spyOn(coordinator, "getSnapshot");
      for (const change of [
        { phase: "loading" as const },
        { phase: "saving" as const },
        { conflict: true },
        { uncertain: true },
        { replayPending: true },
        { latestLoaded: false },
        { baseVersion: 0 },
        { draft: null },
      ]) {
        getSnapshot.mockReturnValue({
          ...original,
          ...change,
        });
        expect(
          preparePortfolioWatchlist(workspace, listing.listingId).preview,
        ).toBeNull();
      }
    },
  );

  it("requires the imported Watchlist catalog review and matching current digests", async () => {
    const { workspace } = await fixture();
    workspace.setView("watchlist");
    expect(
      workspace.restoreWatchlistFileDraft(
        workspace.coordinator.getSnapshot().draft!,
      ),
    ).toBe(true);
    workspace.setView("portfolio");
    expect(
      preparePortfolioWatchlist(workspace, listing.listingId).preview,
    ).toBeNull();
    vi.spyOn(workspace, "watchlistFileCatalogReviewRequired").mockReturnValue(
      false,
    );
    const draft = workspace.coordinator.getSnapshot().draft!;
    workspace.coordinator.replaceDraft({
      ...draft,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    expect(
      preparePortfolioWatchlist(workspace, listing.listingId).preview,
    ).toBeNull();
  });

  it.each([
    "navigation",
    "route",
    "watchlist",
    "portfolio",
    "catalog",
    "session",
    "editor",
    "review",
  ] as const)(
    "expires the preview after %s changes, including changes reverted later",
    async (change) => {
      const f = await fixture();
      const { workspace } = f;
      const preview = review(workspace);
      if (change === "navigation") {
        workspace.setNavigationBlocked(true);
        expect(
          preparePortfolioWatchlist(workspace, listing.listingId).preview,
        ).toBeNull();
        workspace.setNavigationBlocked(false);
      } else if (change === "route") {
        workspace.setView("watchlist");
        workspace.setView("portfolio");
      } else if (change === "watchlist") {
        const draft = workspace.coordinator.getSnapshot().draft!;
        workspace.note(other.listingId, "Changed");
        workspace.coordinator.replaceDraft(draft);
      } else if (change === "portfolio") {
        const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
        workspace.portfolio.replace(draft, {
          ...draft.ledger!,
          opening: { ...draft.ledger!.opening, cashUsd: "99.00" },
        });
        workspace.portfolio.coordinator.replaceDraft(draft);
      } else if (change === "catalog") {
        await workspace.refreshCatalog();
      } else if (change === "session") {
        workspace.sessionOwner.retire("Invented session expiry");
      } else if (change === "editor") {
        const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
        workspace.portfolio.setPendingEditor(draft, true);
        workspace.portfolio.setPendingEditor(draft, false);
      } else {
        await workspace.portfolio.reviewCatalog();
        workspace.portfolio.cancelReview();
      }
      refuse(workspace, preview);
    },
  );

  it("consumes before notification, rejects forged and cross-workspace previews", async () => {
    const first = await fixture();
    const second = await fixture();
    const preview = review(first.workspace);
    refuse(second.workspace, preview);
    refuse(first.workspace, { ...preview });
    const reentry = vi.fn(() =>
      applyPortfolioWatchlist(first.workspace, preview),
    );
    first.workspace.coordinator.subscribe(reentry);
    expect(applyPortfolioWatchlist(first.workspace, preview).added).toBe(true);
    expect(reentry).toHaveReturnedWith(
      expect.objectContaining({ added: false }),
    );
    expect(
      first.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.filter(
          (member) => member.listingId === listing.listingId,
        ),
    ).toHaveLength(1);
    expect(first.api.save).not.toHaveBeenCalled();
  });

  it("refuses a loaded Watchlist save that becomes uncertain", async () => {
    const { workspace, api } = await fixture();
    const preview = review(workspace);
    api.save.mockRejectedValueOnce(new TrialApiError("commit_unknown"));
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().uncertain).toBe(true);
    refuse(workspace, preview);
    expect(
      preparePortfolioWatchlist(workspace, listing.listingId).preview,
    ).toBeNull();
  });
});
