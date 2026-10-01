import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import {
  listingMembership,
  ManagedWorkspace,
  reviewChanges,
} from "./managed-workspace";
import type { TrialSession } from "./session";

const digest = `sha256:${"a".repeat(64)}` as const;
const nextDigest = `sha256:${"b".repeat(64)}` as const;
const result: PersonalSecurityMasterSearchResultDto = {
  cik: "0000000001",
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: "issuer-one",
  issuerName: "Invented issuer",
  listingId: "listing-one",
  matchKind: "name_exact",
  matchedValue: "Invented issuer",
  securityId: "security-one",
  securityName: "Common stock",
  shareClassId: "class-one",
  shareClassName: "Class A",
  symbol: "DEMO",
};
const second = {
  ...result,
  listingId: "listing-two",
  symbol: "OTHER",
  shareClassId: "class-two",
  shareClassName: "Class B",
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "catalog-invented",
  catalogVersion: "version-invented",
  acquiredAt: "2026-09-29T00:00:00.000Z",
  generatedAt: "2026-09-30T00:00:00.000Z",
  asOf: "2026-09-30T12:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 2,
    activeListings: 2,
    admittedSourceRecords: 2,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 2,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};
const empty: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: digest,
  memberships: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture(initial = empty) {
  let stored = { version: 1, payload: structuredClone(initial) };
  const api: ManagedApi = {
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn<ManagedApi["search"]>().mockResolvedValue({
      snapshot,
      results: [result, second],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "INVENTED",
    }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: listingMembership({ ...result, listingId }),
        })),
      }),
    ),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    save: vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    }),
  };
  const session: TrialSession = {
    userId: "user_synthetic",
    sessionId: "session_synthetic",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  let keys = 0;
  const workspace = new ManagedWorkspace(
    api,
    session,
    () => `synthetic-command-${++keys}`,
  );
  return { workspace, api, session, saved: () => structuredClone(stored) };
}
async function ready(workspace: ManagedWorkspace) {
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setQuery("Invented");
  await workspace.search();
}

describe("managed workspace composition", () => {
  it("adds exact listings, normalizes notes, orders, removes, explicitly saves and reopens the same list", async () => {
    const { workspace, api, session, saved } = fixture();
    await ready(workspace);
    workspace.add(result);
    workspace.add(second);
    workspace.add(result);
    workspace.note(result.listingId, "  Cafe\u0301 thesis  ");
    workspace.move(second.listingId, -1);
    expect(api.save).not.toHaveBeenCalled();
    await workspace.coordinator.save();
    expect(
      saved().payload.memberships.map((member) => member.listingId),
    ).toEqual([second.listingId, result.listingId]);
    expect(saved().payload.memberships[1]?.note).toBe("Café thesis");
    expect(saved().payload.memberships[0]?.shareClassId).toBe("class-two");
    workspace.remove(second.listingId);
    await workspace.coordinator.save();
    const reopened = new ManagedWorkspace(api, session);
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
    expect(saved().payload.memberships).toHaveLength(1);
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it("rejects fabricated search objects and does not conflate equal symbols with exact listing IDs", async () => {
    const { workspace, api } = fixture();
    const alternate = { ...second, symbol: result.symbol };
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [result, alternate],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await ready(workspace);
    workspace.add({ ...result });
    expect(workspace.coordinator.getSnapshot().dirty).toBe(false);
    workspace.add(result);
    workspace.add(alternate);
    expect(
      workspace.coordinator
        .getSnapshot()
        .draft?.memberships.map((member) => member.listingId),
    ).toEqual(["listing-one", "listing-two"]);
  });

  it("keeps a draft through version conflict and requires the latest read plus explicit choice", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      conflict: true,
      uncertain: false,
      dirty: true,
    });
    await workspace.reviewCatalog();
    expect(api.resolve).not.toHaveBeenCalled();
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft?.memberships).toHaveLength(
      1,
    );
    workspace.coordinator.keepDraft();
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(workspace.coordinator.getSnapshot().conflict).toBe(false);
  });

  it("can explicitly discard the draft in favor of the latest saved order and notes", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    vi.mocked(api.load).mockResolvedValueOnce({
      version: 4,
      payload: {
        ...empty,
        memberships: [{ ...listingMembership(second), note: "Other device" }],
      },
    });
    await workspace.coordinator.load();
    workspace.coordinator.useSaved();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 4,
      dirty: false,
      conflict: false,
    });
    expect(
      workspace.coordinator.getSnapshot().draft?.memberships[0],
    ).toMatchObject({ listingId: "listing-two", note: "Other device" });
  });

  it("reconciles one immutable pending command and requires a fresh choice after its replay", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    workspace.note(result.listingId, "original");
    vi.mocked(api.save)
      .mockRejectedValueOnce(new TrialApiError("commit_unknown"))
      .mockImplementationOnce((command) =>
        Promise.resolve({
          version: command.expectedVersion + 1,
          payload: command.payload,
          replayed: true,
        }),
      );
    await workspace.coordinator.save();
    workspace.note(result.listingId, "changed");
    workspace.remove(result.listingId);
    await workspace.reviewCatalog();
    await workspace.coordinator.load();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.load).toHaveBeenCalledTimes(1);
    await workspace.coordinator.reconcile();
    expect(vi.mocked(api.save).mock.calls[1]?.[0]).toEqual(
      vi.mocked(api.save).mock.calls[0]?.[0],
    );
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      replayPending: true,
      conflict: true,
      uncertain: false,
    });
    workspace.note(result.listingId, "blocked");
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledTimes(2);
    await workspace.coordinator.load();
    workspace.coordinator.keepDraft();
    workspace.note(result.listingId, "allowed");
    expect(
      workspace.coordinator.getSnapshot().draft?.memberships[0]?.note,
    ).toBe("allowed");
  });

  it.each(["bad\u0000note", "x".repeat(2001)])(
    "rejects an invalid note before dispatch %#",
    async (note) => {
      const { workspace, api } = fixture();
      await ready(workspace);
      workspace.add(result);
      workspace.note(result.listingId, note);
      await workspace.coordinator.save();
      expect(api.save).not.toHaveBeenCalled();
      expect(workspace.coordinator.getSnapshot().uncertain).toBe(false);
    },
  );

  it("enforces canonical payload bytes before capturing a command", async () => {
    const oversized = {
      ...empty,
      memberships: Array.from({ length: 120 }, (_, index) => ({
        ...listingMembership(result),
        listingId: `listing-${index}`,
        note: "界".repeat(2000),
      })),
    };
    const { workspace, api } = fixture(oversized);
    await ready(workspace);
    workspace.note("listing-0", "still too large");
    await workspace.coordinator.save();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("fences stale search responses when the query changes or a newer search finishes", async () => {
    const { workspace, api } = fixture();
    const old = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
    vi.mocked(api.search).mockReturnValueOnce(old.promise);
    workspace.setQuery("old");
    const pending = workspace.search();
    const signal = vi.mocked(api.search).mock.calls[0]![1];
    workspace.setQuery("new");
    await workspace.search();
    expect(signal.aborted).toBe(true);
    old.resolve({
      snapshot,
      results: [],
      totalMatches: 0,
      limitApplied: 25,
      normalizedQuery: "OLD",
    });
    await pending;
    expect(workspace.getSnapshot()).toMatchObject({
      query: "new",
      results: [result, second],
      busy: false,
    });
  });

  it("retires all catalog work synchronously when load rejects authentication", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    const searching = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
    const resolving = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    vi.mocked(api.search).mockReturnValueOnce(searching.promise);
    vi.mocked(api.resolve).mockReturnValueOnce(resolving.promise);
    workspace.setQuery("private query");
    const search = workspace.search();
    const review = workspace.reviewCatalog();
    vi.mocked(api.load).mockRejectedValueOnce(
      new TrialApiError("unauthenticated"),
    );
    await workspace.coordinator.load();
    expect(vi.mocked(api.search).mock.calls.at(-1)?.[1].aborted).toBe(true);
    expect(vi.mocked(api.resolve).mock.calls.at(-1)?.[1].aborted).toBe(true);
    expect(workspace.getSnapshot()).toMatchObject({
      query: "",
      snapshot: null,
      results: [],
      review: null,
    });
    searching.resolve({
      snapshot,
      results: [result],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "PRIVATE",
    });
    resolving.resolve({
      snapshotSha256: digest,
      results: [{ listingId: result.listingId, listing: null }],
    });
    await search;
    await review;
    expect(workspace.getSnapshot()).toMatchObject({
      query: "",
      snapshot: null,
      results: [],
      review: null,
    });
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
  });

  it.each(["search", "resolve"] as const)(
    "routes %s authentication failure to the same retirement path",
    async (operation) => {
      const { workspace, api } = fixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      await ready(workspace);
      vi.mocked(api[operation]).mockRejectedValueOnce(
        new TrialApiError("access_denied"),
      );
      if (operation === "search") await workspace.search();
      else await workspace.reviewCatalog();
      expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
      expect(workspace.getSnapshot().snapshot).toBeNull();
    },
  );

  it("fences late failed sign-out after another retirement", async () => {
    const { workspace, session } = fixture();
    await ready(workspace);
    const signOut = deferred<void>();
    vi.mocked(session.signOut).mockReturnValue(signOut.promise);
    const pending = workspace.coordinator.signOut();
    workspace.coordinator.retire("New identity replaced this session.");
    signOut.reject(new Error("late"));
    await pending;
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      message: "New identity replaced this session.",
      signOutFailed: false,
      phase: "retired",
    });
  });

  it("reviews only one explicit 50-ID batch, then applies identities and removals while preserving retained notes and order", async () => {
    const initial = {
      ...empty,
      memberships: Array.from({ length: 51 }, (_, index) => ({
        ...listingMembership(result),
        listingId: `listing-${index}`,
        note: `note-${index}`,
      })),
    };
    const { workspace, api } = fixture(initial);
    await ready(workspace);
    vi.mocked(api.status).mockResolvedValueOnce({
      snapshot: { ...snapshot, snapshotSha256: nextDigest },
    });
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: nextDigest,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            listingId === "listing-1"
              ? null
              : {
                  ...listingMembership(result),
                  listingId,
                  issuerName: "Updated issuer",
                },
        })),
      }),
    );
    await workspace.reviewCatalog();
    expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.resolve).mock.calls[0]?.[0].listingIds).toHaveLength(
      50,
    );
    workspace.applyReview();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(initial);
    await workspace.nextReviewBatch();
    expect(api.resolve).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.resolve).mock.calls[1]?.[0].listingIds).toEqual([
      "listing-50",
    ]);
    expect(reviewChanges(workspace.getSnapshot().review!)).toHaveLength(51);
    workspace.applyReview();
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.snapshotSha256).toBe(nextDigest);
    expect(draft.memberships).toHaveLength(50);
    expect(draft.memberships[0]).toMatchObject({
      listingId: "listing-0",
      note: "note-0",
      issuerName: "Updated issuer",
    });
    expect(draft.memberships[1]).toMatchObject({
      listingId: "listing-2",
      note: "note-2",
    });
    expect(api.save).not.toHaveBeenCalled();
  });

  it("invalidates review on a draft edit and ignores the held resolve result", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    vi.mocked(api.resolve).mockReturnValueOnce(held.promise);
    const pending = workspace.reviewCatalog();
    workspace.note(result.listingId, "new note");
    expect(vi.mocked(api.resolve).mock.calls[0]?.[1].aborted).toBe(true);
    held.resolve({
      snapshotSha256: digest,
      results: [{ listingId: result.listingId, listing: null }],
    });
    await pending;
    workspace.applyReview();
    expect(workspace.getSnapshot().review).toBeNull();
    expect(
      workspace.coordinator.getSnapshot().draft?.memberships[0]?.note,
    ).toBe("new note");
  });

  it("invalidates a partial review when fresh catalog metadata changes", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    await workspace.reviewCatalog();
    vi.mocked(api.status).mockResolvedValueOnce({
      snapshot: { ...snapshot, snapshotSha256: nextDigest },
    });
    await workspace.refreshCatalog();
    expect(workspace.getSnapshot().review).toBeNull();
  });

  it("never marks a read-only catalog failure as an uncertain write or retries it", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    vi.mocked(api.resolve).mockRejectedValueOnce(
      new ManagedCatalogChangedError(),
    );
    await workspace.reviewCatalog();
    expect(workspace.getSnapshot()).toMatchObject({
      review: null,
      reviewing: false,
    });
    expect(workspace.getSnapshot().message).toContain("Refresh the catalog");
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: false,
      dirty: false,
    });
    expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("moves an empty list to the reviewed digest only after explicit apply without resolving IDs", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    vi.mocked(api.status).mockResolvedValueOnce({
      snapshot: { ...snapshot, snapshotSha256: nextDigest },
    });
    await workspace.refreshCatalog();
    await workspace.reviewCatalog();
    expect(workspace.coordinator.getSnapshot().draft?.snapshotSha256).toBe(
      digest,
    );
    workspace.applyReview();
    expect(workspace.coordinator.getSnapshot().draft?.snapshotSha256).toBe(
      nextDigest,
    );
    expect(api.resolve).not.toHaveBeenCalled();
  });
});
