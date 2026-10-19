import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import type { TrialSession } from "./session";
import { captureWatchlistDraftFileContext } from "./managed-watchlist-draft-context";
import type { SaveState } from "./save-coordinator";

const TIME = "2026-10-18T23:01:02.345Z";
const SNAPSHOT: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented-draft-catalog",
  catalogVersion: "invented-v1",
  acquiredAt: TIME,
  generatedAt: TIME,
  asOf: "2026-10-18",
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
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};

const first = { ...eodSelection.listing, note: "Original saved note" };
const second = {
  ...first,
  listingId: "listing-second",
  symbol: "SECOND",
  issuerId: "issuer-second",
  note: "Second saved note",
};
const initial: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: SNAPSHOT.snapshotSha256,
  memberships: [first, second],
};
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
async function fixture() {
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected provider request")),
  );
  const api: ManagedApi = {
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: unexpected,
    savePortfolio: unexpected,
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>().mockResolvedValue({
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    }),
    saveFollowups: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    economicCalendar: unexpected,
    eodHistory: unexpected,
    annualReport: unexpected,
    search: unexpected,
    status: vi
      .fn<ManagedApi["status"]>()
      .mockResolvedValue({ snapshot: SNAPSHOT }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            initial.memberships.find(
              (member) => member.listingId === listingId,
            ) ?? null,
        })),
      }),
    ),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() =>
        Promise.resolve({ version: 3, payload: structuredClone(initial) }),
      ),
    save: vi.fn<ManagedApi["save"]>().mockImplementation((command) =>
      Promise.resolve({
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
        replayed: false,
      }),
    ),
  };
  const session: TrialSession = {
    userId: "invented-file-user",
    sessionId: "invented-file-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(
    api,
    session,
    () => "invented-command",
    {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: [first, second],
    },
  );
  cleanup.push(() => workspace.sessionOwner.dispose());
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  return { workspace, api, unexpected };
}
function imported(): MainWatchlistPayload {
  return {
    ...initial,
    memberships: [
      {
        ...second,
        issuerName: "Unverified issuer",
        shareClassName: "Unverified class",
        note: "  Raw\r\nnote  ",
      },
      {
        ...first,
        securityName: "Unverified security",
        note: "First imported note",
      },
    ],
  };
}

describe("imported Watchlist catalog provenance", () => {
  it("refuses a matching file digest and stale listing handles without provider requests", async () => {
    const { workspace, api, unexpected } = await fixture();
    expect(workspace.canSavePayload()).toBe(true);
    const price = workspace.watchlistPrices.getSnapshot().rows[0]!;
    const comparison = workspace.annualComparison.getSnapshot();
    const member = comparison.memberships[0]!;
    workspace.annualComparison.select("left", comparison, member);
    const filings = workspace.watchlistFilings.getSnapshot();
    const filingMember = filings.memberships[0]!;
    workspace.watchlistFilings.select(filings, filingMember);
    const file = imported();
    expect(workspace.restoreWatchlistFileDraft(file)).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft).toEqual(file);
    expect(draft).not.toBe(file);
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(workspace.canSavePayload()).toBe(false);
    expect(workspace.canSavePayload()).toBe(false);
    expect(workspace.saveIssue()).toContain("Review imported file listings");
    expect(workspace.canOpenWatchlistAnnual(draft.memberships[0]!)).toBe(false);
    expect(workspace.canOpenWatchlistEod(draft.memberships[0]!)).toBe(false);
    expect(workspace.watchlistPrices.getSnapshot()).toMatchObject({
      canRead: false,
      rows: [],
    });
    expect(workspace.annualComparison.getSnapshot()).toMatchObject({
      canRead: false,
      memberships: [],
      left: { selected: null },
    });
    expect(workspace.watchlistFilings.getSnapshot()).toMatchObject({
      canRead: false,
      memberships: [],
      selected: null,
    });
    workspace.openWatchlistAnnual(draft.memberships[0]!);
    workspace.openWatchlistEod(draft.memberships[0]!);
    await workspace.loadWatchlistPrice(price.handle);
    await workspace.annualComparison.load("left", member);
    await workspace.watchlistFilings.load(filingMember);
    await workspace.coordinator.save();
    workspace.applyReview();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it("applies independently resolved identities while preserving file order and raw notes", async () => {
    const { workspace, api, unexpected } = await fixture();
    const file = imported();
    workspace.restoreWatchlistFileDraft(file);
    await workspace.reviewCatalog();
    expect(api.resolve).toHaveBeenCalledOnce();
    expect(api.resolve).toHaveBeenCalledWith(
      {
        snapshotSha256: SNAPSHOT.snapshotSha256,
        listingIds: [second.listingId, first.listingId],
      },
      expect.any(AbortSignal),
    );
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(workspace.canSavePayload()).toBe(false);
    workspace.applyReview();
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(false);
    const reviewed = workspace.coordinator.getSnapshot().draft!;
    expect(reviewed.memberships).toEqual([
      { ...second, note: file.memberships[0]!.note },
      { ...first, note: file.memberships[1]!.note },
    ]);
    expect(reviewed.snapshotSha256).toBe(file.snapshotSha256);
    expect(workspace.canSavePayload()).toBe(false);
    expect(workspace.saveIssue()).toContain("without control characters");
    expect(workspace.canOpenWatchlistAnnual(reviewed.memberships[0]!)).toBe(
      true,
    );
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(true);
    expect(workspace.annualComparison.getSnapshot().canRead).toBe(true);
    expect(workspace.watchlistFilings.getSnapshot().canRead).toBe(true);
    expect(unexpected).not.toHaveBeenCalled();
    workspace.note(second.listingId, "Reviewed note");
    expect(workspace.canSavePayload()).toBe(true);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
  });

  it("retains the requirement through edits, stale review, conflict reload and keep draft", async () => {
    const { workspace, api, unexpected } = await fixture();
    workspace.restoreWatchlistFileDraft(imported());
    await workspace.reviewCatalog();
    workspace.note(second.listingId, "Edited imported note");
    workspace.applyReview();
    workspace.move(second.listingId, 1);
    workspace.remove(first.listingId);
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(workspace.canSavePayload()).toBe(false);
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().conflict).toBe(true);
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    workspace.coordinator.keepDraft();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      conflict: false,
      dirty: true,
    });
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...imported().memberships[0]!, note: "Edited imported note" },
    ]);
    expect(workspace.canSavePayload()).toBe(false);
    expect(api.resolve).toHaveBeenCalledOnce();
    expect(unexpected).not.toHaveBeenCalled();
    workspace.coordinator.useSaved();
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(initial);
    expect(workspace.canSavePayload()).toBe(true);
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(true);
    await workspace.coordinator.load();
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(false);
  });

  it("requires catalog review before an imported listing can become a research follow-up", async () => {
    const { workspace, unexpected } = await fixture();
    await workspace.followups.coordinator.load();
    workspace.restoreWatchlistFileDraft(imported());
    workspace.followups.add(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      "2026-10-20",
    );
    expect(
      workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toEqual([]);
    await workspace.reviewCatalog();
    workspace.applyReview();
    const reviewed = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.followups.add(reviewed, "2026-10-20");
    expect(
      workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toHaveLength(1);
    expect(
      workspace.followups.coordinator.getSnapshot().draft!.entries[0]!.listing,
    ).toMatchObject({
      issuerName: second.issuerName,
      shareClassName: second.shareClassName,
    });
    expect(unexpected).not.toHaveBeenCalled();
  });

  it("captures actual references and distinguishes fresh import from unconfirmed export", async () => {
    const { workspace } = await fixture();
    const state = workspace.coordinator.getSnapshot();
    const view = workspace.getSnapshot();
    const context = workspace.getWatchlistDraftFileContext()!;
    expect(context.saved).toBe(state.saved);
    expect(context.draft).toBe(state.draft);
    expect(context.catalog).toBe(view.snapshot);
    expect(context.baseVersion).toBe(state.baseVersion);
    for (const patch of [{ latestLoaded: false }, { baseVersion: 2 }]) {
      const changed = { ...state, ...patch };
      expect(captureWatchlistDraftFileContext(changed, view, true)).toBeNull();
      expect(
        captureWatchlistDraftFileContext(changed, view, false),
      ).not.toBeNull();
    }
    workspace.setNavigationBlocked(true);
    expect(workspace.getWatchlistDraftFileContext()).toBeNull();
    expect(workspace.getWatchlistDraftFileContext(false)).toBeNull();
    workspace.setNavigationBlocked(false);
    expect(workspace.getWatchlistDraftFileContext()).not.toBeNull();
  });

  it("refuses unsettled saved state and competing view activity for import and export", async () => {
    const { workspace } = await fixture();
    const state = workspace.coordinator.getSnapshot();
    const view = workspace.getSnapshot();
    const patches: Partial<SaveState<MainWatchlistPayload>>[] = [
      { phase: "loading" },
      { saved: null },
      { draft: null },
      { baseVersion: null },
      { conflict: true },
      { uncertain: true },
      { replayPending: true },
    ];
    for (const patch of patches) {
      const changed = { ...state, ...patch };
      expect(captureWatchlistDraftFileContext(changed, view, true)).toBeNull();
      expect(captureWatchlistDraftFileContext(changed, view, false)).toBeNull();
    }
    const views = [
      { ...view, view: "markets" as const },
      { ...view, read: "status" as const },
      { ...view, reviewing: true },
      {
        ...view,
        review: {
          draft: state.draft!,
          snapshotSha256: state.draft!.snapshotSha256,
          results: [],
        },
      },
    ];
    for (const changed of views) {
      expect(captureWatchlistDraftFileContext(state, changed, true)).toBeNull();
      expect(
        captureWatchlistDraftFileContext(state, changed, false),
      ).toBeNull();
    }
  });

  it("rejects competing catalog review and clears imported authority on session disposal", async () => {
    const { workspace, unexpected } = await fixture();
    await workspace.reviewCatalog();
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(workspace.restoreWatchlistFileDraft(imported())).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(false);
    workspace.applyReview();
    expect(workspace.restoreWatchlistFileDraft(imported())).toBe(true);
    workspace.sessionOwner.dispose();
    expect(workspace.watchlistFileCatalogReviewRequired()).toBe(false);
    expect(workspace.restoreWatchlistFileDraft(imported())).toBe(false);
    expect(workspace.canSavePayload()).toBe(false);
    expect(unexpected).not.toHaveBeenCalled();
  });
});
