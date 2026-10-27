import { afterEach, expect, it, vi } from "vitest";
import type {
  ManagedCatalogSnapshotDto,
  ManagedPortfolioPayload,
  ResearchFollowup,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { prepareHoldingFollowup } from "./managed-holding-followup";
import { eodSelection } from "./eod-history-fixture";
import { TrialApiError } from "./api";
const listing = eodSelection.listing,
  digest = eodSelection.catalogSnapshotSha256;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-holding-followup",
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
    asOfDate: "2026-10-03",
    cashUsd: "100.00",
    holdings: [
      {
        listingId: listing.listingId,
        shares: "2.000000",
        totalCostBasisUsd: null,
        confirmedOn: "2026-10-02",
      },
    ],
  },
  transactions: [],
};
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function fixture(
  load = true,
  initial: ResearchFollowupsPayload = { schemaVersion: 1, entries: [] },
  value = ledger,
) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
  let stored = {
    version: initial.entries.length ? 1 : 0,
    payload: structuredClone(initial),
  };
  const unexpected = vi.fn(() =>
    Promise.reject(
      new Error("No automatic Watchlist or company-source operation"),
    ),
  );
  const api = {
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    load: vi.fn<ManagedApi["load"]>(unexpected),
    save: unexpected,
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockResolvedValue({ version: 1, payload: value }),
    savePortfolio: unexpected,
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve(structuredClone(stored)),
    ),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    }),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: { ...listing, listingId },
        })),
      }),
    ),
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
  const make = () => {
    const workspace = new ManagedWorkspace(api, {
      userId: "invented-holding-owner",
      sessionId: `invented-session-${owners.length}`,
      getToken: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    });
    owners.push(workspace);
    return workspace;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  workspace.setView("portfolio");
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
  workspace.openPortfolioResearch(draft, draft.ledger!.identities[0]!);
  const selection = workspace.getSnapshot().research!.selection;
  const initialLoad = () =>
    workspace.loadHoldingFollowups(selection, () => true);
  if (load) await initialLoad();
  const prepare = (
    check = "Café 東京 😀 complete holding question",
    date = "2026-12-31",
  ) => {
    const context = workspace.captureHoldingFollowup(selection);
    expect(context.reason).toBeNull();
    expect(context.port).not.toBeNull();
    const prepared = prepareHoldingFollowup(
      context.port!,
      check,
      date,
      () => true,
    );
    expect(prepared.reason).toBeNull();
    expect(prepared.preview).not.toBeNull();
    return prepared.preview!;
  };
  return {
    workspace,
    api,
    unexpected,
    make,
    draft,
    selection,
    initialLoad,
    prepare,
    stored: () => stored,
  };
}
it("creates outside an unloaded Watchlist, retains Portfolio Back and saves only Follow-ups before a fresh Load", async () => {
  const f = await fixture();
  const portfolio = f.workspace.portfolio.coordinator.getSnapshot(),
    watchlist = f.workspace.coordinator.getSnapshot();
  expect(watchlist.draft).toBeNull();
  expect(f.workspace.getHoldingResearchPosition(f.selection)).toMatchObject({
    listing,
    shares: "2",
    totalCostBasisUsd: null,
    confirmedOn: "2026-10-02",
  });
  const preview = f.prepare(),
    result = preview.create();
  expect(result).not.toBeNull();
  expect(result!.check).toBe(preview.check);
  expect(result!.completedOn).toBeNull();
  expect(result!.result).toBe("");
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(f.draft);
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.unexpected).not.toHaveBeenCalled();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot().draft!.entries).toEqual([
    result,
  ]);
  expect(fresh.coordinator.getSnapshot().draft).toBeNull();
});
it("exposes a position before explicit initial Follow-ups Load and never replaces an existing draft", async () => {
  const f = await fixture(false);
  expect(
    f.workspace.getHoldingResearchPosition(f.selection)?.totalCostBasisUsd,
  ).toBeNull();
  expect(f.workspace.captureHoldingFollowup(f.selection).port).toBeNull();
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(true);
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  await f.initialLoad();
  const saved = f.workspace.followups.coordinator.getSnapshot();
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(false);
  await f.initialLoad();
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(saved);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.prepare().create()).not.toBeNull();
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("permits explicit Load retry after failure without a company request or automatic creation", async () => {
  const f = await fixture(false);
  f.api.loadFollowups.mockRejectedValueOnce(new TrialApiError("unavailable"));
  await f.initialLoad();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(true);
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual([]);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it.each([
  "portfolio-file",
  "followups-file",
  "route",
  "form",
  "filter",
] as const)(
  "refuses late initial Load after %s retirement",
  async (boundary) => {
    const f = await fixture(false);
    const pending =
      deferred<Awaited<ReturnType<ManagedApi["loadFollowups"]>>>();
    f.api.loadFollowups.mockReturnValueOnce(pending.promise);
    const loading = f.initialLoad();
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    if (boundary === "portfolio-file") {
      const token = {};
      f.workspace.portfolio.beginDraftFileActivity(token);
      f.workspace.portfolio.endDraftFileActivity(token);
    }
    if (boundary === "followups-file") {
      const token = {};
      f.workspace.followups.beginDraftFileActivity(token);
      f.workspace.followups.endDraftFileActivity(token);
    }
    if (boundary === "route") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "form") {
      f.workspace.portfolio.setPendingEditor(f.draft, true);
      f.workspace.portfolio.setPendingEditor(f.draft, false);
    }
    if (boundary === "filter") {
      f.workspace.followups.setFilter("all");
      f.workspace.followups.setFilter("open");
    }
    pending.resolve({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    await loading;
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.unexpected).not.toHaveBeenCalled();
  },
);
type HoldingFixture = Awaited<ReturnType<typeof fixture>>;
const previewRetirements: readonly (readonly [
  string,
  (f: HoldingFixture) => void | Promise<void>,
])[] = [
  [
    "portfolio-file",
    (f) => {
      const token = {};
      f.workspace.portfolio.beginDraftFileActivity(token);
      f.workspace.portfolio.endDraftFileActivity(token);
    },
  ],
  [
    "followups-file",
    (f) => {
      const token = {};
      f.workspace.followups.beginDraftFileActivity(token);
      f.workspace.followups.endDraftFileActivity(token);
    },
  ],
  [
    "editor",
    (f) => {
      f.workspace.portfolio.setPendingEditor(f.draft, true);
      f.workspace.portfolio.setPendingEditor(f.draft, false);
    },
  ],
  [
    "draft",
    (f) => {
      f.workspace.portfolio.coordinator.replaceDraft(f.draft);
    },
  ],
  [
    "followups",
    (f) => {
      f.workspace.followups.coordinator.replaceDraft({
        schemaVersion: 1,
        entries: [],
      });
    },
  ],
  [
    "navigation",
    (f) => {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    },
  ],
  [
    "catalog",
    async (f) => {
      await f.workspace.refreshCatalog();
    },
  ],
  [
    "session",
    (f) => {
      f.workspace.sessionOwner.retire("Invented session expired");
    },
  ],
];
it.each(previewRetirements)(
  "permanently retires preview after %s round trip",
  async (_boundary, retire) => {
    const f = await fixture();
    const preview = f.prepare();
    await retire(f);
    expect(preview.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
  },
);
it("refuses forged/cross-workspace selections and position fields", async () => {
  const a = await fixture(),
    b = await fixture();
  expect(a.workspace.getHoldingResearchPosition({ ...a.selection })).toBeNull();
  expect(b.workspace.captureHoldingFollowup(a.selection).port).toBeNull();
  for (const field of ["shares", "totalCostBasisUsd", "confirmedOn"] as const) {
    const port = a.workspace.captureHoldingFollowup(a.selection).port!;
    const forged = {
      ...port,
      position: {
        ...port.position,
        [field]:
          field === "shares"
            ? "3.000000"
            : field === "confirmedOn"
              ? "2026-10-03"
              : "0.00",
      },
    };
    expect(
      prepareHoldingFollowup(forged, "Question", "2026-12-31", () => true)
        .preview,
    ).toBeNull();
  }
  expect(
    a.workspace.captureHoldingFollowup({
      ...a.selection,
      listing: { ...listing, shareClassId: "different" },
    }).port,
  ).toBeNull();
});
it("keeps general registered closed-position research but refuses only the new positive-holding action", async () => {
  const f = await fixture(
    false,
    { schemaVersion: 1, entries: [] },
    { ...ledger, opening: { ...ledger.opening, holdings: [] } },
  );
  expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
    "portfolio",
  );
  expect(f.workspace.getHoldingResearchPosition(f.selection)).toBeNull();
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(false);
  expect(f.workspace.captureHoldingFollowup(f.selection).port).toBeNull();
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
});
it("opens the exact completed existing entry for review without overwriting or requiring Watchlist", async () => {
  const existing: ResearchFollowup = {
    id: "00000000-0000-4000-8000-000000000001",
    listing,
    catalogSnapshotSha256: digest,
    check: "Keep this whole original check",
    dueOn: "2026-11-01",
    status: "completed",
    completedOn: "2026-10-24",
    result: "Keep authored result",
  };
  const f = await fixture(true, { schemaVersion: 1, entries: [existing] });
  const before = f.workspace.followups.coordinator.getSnapshot();
  const context = f.workspace.captureHoldingFollowup(f.selection);
  expect(context.port).not.toBeNull();
  expect(
    prepareHoldingFollowup(
      context.port!,
      "Do not replace",
      "2026-12-31",
      () => true,
    ).preview,
  ).toBeNull();
  const review = f.workspace.reviewHoldingFollowup(f.selection);
  expect(review?.entry).toBe(before.draft!.entries[0]);
  expect(review?.isCurrent()).toBe(true);
  expect(f.workspace.getSnapshot().view).toBe("followups");
  expect(f.workspace.followups.getSnapshot().filter).toBe("completed");
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("creates outside an independently loaded dirty Watchlist without changing or saving it", async () => {
  const f = await fixture();
  const other = {
    ...listing,
    listingId: "other-listing",
    symbol: "OTHER",
    note: "Keep this other company note",
  };
  f.api.load.mockResolvedValueOnce({
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [other],
    },
  });
  await f.workspace.coordinator.load();
  const loaded = f.workspace.coordinator.getSnapshot().draft!;
  const dirtyNote = "Keep this unsaved independent note · Café 東京";
  f.workspace.coordinator.replaceDraft({
    ...loaded,
    memberships: loaded.memberships.map((member) => ({
      ...member,
      note: dirtyNote,
    })),
  });
  const before = f.workspace.coordinator.getSnapshot();
  vi.clearAllMocks();
  expect(f.prepare().create()).not.toBeNull();
  expect(f.workspace.coordinator.getSnapshot()).toBe(before);
  expect(before.dirty).toBe(true);
  expect(before.draft!.memberships[0]!.note).toBe(dirtyNote);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it.each(["shares", "totalCostBasisUsd", "confirmedOn"] as const)(
  "retires on actual projected %s changes even after restoring the old ledger",
  async (field) => {
    const f = await fixture();
    const preview = f.prepare();
    const holding = {
      ...ledger.opening.holdings[0]!,
      [field]:
        field === "shares"
          ? "3.000000"
          : field === "confirmedOn"
            ? "2026-10-03"
            : "0.00",
    };
    f.workspace.portfolio.replace(f.draft, {
      ...ledger,
      opening: { ...ledger.opening, holdings: [holding] },
    });
    expect(preview.isCurrent()).toBe(false);
    f.workspace.portfolio.coordinator.replaceDraft(f.draft);
    expect(preview.create()).toBeNull();
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toEqual([]);
  },
);
it.each(["conflict", "unavailable"] as const)(
  "refuses Follow-ups %s recovery while preserving every authored field",
  async (code) => {
    const f = await fixture();
    const captured = f.prepare();
    const created = captured.create()!;
    const draft = f.workspace.followups.coordinator.getSnapshot().draft;
    f.api.saveFollowups.mockRejectedValueOnce(new TrialApiError(code));
    await f.workspace.followups.coordinator.save();
    expect(f.workspace.captureHoldingFollowup(f.selection).port).toBeNull();
    expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(false);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      draft,
    );
    expect(f.workspace.followups.currentEntry(created.id)?.check).toBe(
      created.check,
    );
    expect(f.unexpected).not.toHaveBeenCalled();
  },
);

async function settleHoldingUrl(f: HoldingFixture) {
  f.workspace.setNavigationBlocked(true);
  await f.workspace.setCompanyRoute({
    kind: "company",
    listingId: f.selection.listing.listingId,
    section: "eod",
  });
  expect(f.workspace.getSnapshot().companyRoute?.status).toBe("open");
}
it("loads and creates only after the exact holding URL settles without touching other resource drafts", async () => {
  const f = await fixture(false);
  const portfolio = f.workspace.portfolio.coordinator.getSnapshot();
  const watchlist = f.workspace.coordinator.getSnapshot();
  f.workspace.setNavigationBlocked(true);
  expect(f.workspace.getHoldingResearchPosition(f.selection)).toBeNull();
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(false);
  await f.initialLoad();
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  await settleHoldingUrl(f);
  expect(f.workspace.getHoldingResearchPosition(f.selection)).toMatchObject({
    shares: "2",
    totalCostBasisUsd: null,
  });
  expect(f.workspace.canLoadHoldingFollowups(f.selection)).toBe(true);
  await f.initialLoad();
  const created = f.prepare().create();
  expect(created?.listing).toEqual(listing);
  expect(created?.check).toBe("Café 東京 😀 complete holding question");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("retires captures from before the URL handshake and after a different company URL", async () => {
  const f = await fixture();
  const before = f.prepare();
  await settleHoldingUrl(f);
  expect(before.isCurrent()).toBe(false);
  expect(before.create()).toBeNull();
  const settled = f.prepare();
  await f.workspace.setCompanyRoute({
    kind: "company",
    listingId: "other-listing",
    section: "eod",
  });
  expect(settled.isCurrent()).toBe(false);
  expect(settled.create()).toBeNull();
  expect(f.workspace.captureHoldingFollowup(f.selection).port).toBeNull();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
async function holdingReviewFixture() {
  const existing: ResearchFollowup = {
    id: "00000000-0000-4000-8000-000000000001",
    listing,
    catalogSnapshotSha256: digest,
    check: "Keep this original completed check",
    dueOn: "2026-11-01",
    status: "completed",
    completedOn: "2026-10-24",
    result: "Keep the complete result",
  };
  const f = await fixture(true, { schemaVersion: 1, entries: [existing] });
  await settleHoldingUrl(f);
  return f;
}
it("uses an owned router transition for exact completed-entry review and retains its selection after URL settlement", async () => {
  const f = await holdingReviewFixture();
  const saved = f.workspace.followups.coordinator.getSnapshot();
  const portfolio = f.workspace.portfolio.coordinator.getSnapshot();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const navigate = vi.fn(() => {
    f.workspace.setNavigationBlocked(true);
    f.workspace.setView("followups");
    return true;
  });
  const review = f.workspace.reviewHoldingFollowup(f.selection, navigate);
  expect(navigate).toHaveBeenCalledOnce();
  expect(review?.entry).toBe(saved.draft!.entries[0]);
  expect(review?.isCurrent()).toBe(true);
  expect(f.workspace.followups.getSnapshot()).toMatchObject({
    selectedId: review!.entry.id,
    filter: "completed",
  });
  f.workspace.setNavigationBlocked(false);
  await f.workspace.setCompanyRoute(null);
  expect(review!.isCurrent()).toBe(false);
  expect(f.workspace.getSnapshot()).toMatchObject({
    view: "followups",
    research: null,
    companyRoute: null,
  });
  expect(f.workspace.followups.getSnapshot()).toMatchObject({
    selectedId: review!.entry.id,
    filter: "completed",
  });
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(saved);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});
const refusedReviewTransitions: readonly (readonly [
  string,
  (f: HoldingFixture) => boolean,
])[] = [
  ["refused", () => false],
  ["skipped destination", () => true],
  [
    "wrong destination",
    (f) => {
      f.workspace.setView("watchlist");
      return true;
    },
  ],
  [
    "reentrant view",
    (f) => {
      f.workspace.setView("followups");
      f.workspace.setView("followups");
      return true;
    },
  ],
  [
    "file activity round trip",
    (f) => {
      const token = {};
      const saved = f.workspace.followups.coordinator.getSnapshot();
      f.workspace.followups.beginDraftFileActivity(token);
      f.workspace.followups.endDraftFileActivity(token);
      expect(f.workspace.followups.coordinator.getSnapshot()).toBe(saved);
      f.workspace.setView("followups");
      return true;
    },
  ],
  [
    "replaced entry",
    (f) => {
      f.workspace.setView("followups");
      const draft = f.workspace.followups.coordinator.getSnapshot().draft!;
      f.workspace.followups.coordinator.replaceDraft({
        ...draft,
        entries: draft.entries.map((entry) => ({
          ...entry,
          check: "Changed during navigation",
        })),
      });
      return true;
    },
  ],
  [
    "retired session",
    (f) => {
      f.workspace.setView("followups");
      f.workspace.sessionOwner.retire("Retired during navigation");
      return true;
    },
  ],
];
it.each(refusedReviewTransitions)(
  "refuses %s review navigation before selecting an existing entry",
  async (_name, transition) => {
    const f = await holdingReviewFixture();
    const navigate = vi.fn(() => transition(f));
    expect(f.workspace.reviewHoldingFollowup(f.selection, navigate)).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
    expect(f.workspace.followups.getSnapshot().selectedId).toBeNull();
    expect(f.workspace.followups.getSnapshot().filter).toBe("open");
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.unexpected).not.toHaveBeenCalled();
  },
);
