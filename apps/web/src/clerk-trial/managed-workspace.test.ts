import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedAnnualCooldownError,
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  listingMembership,
  ManagedWorkspace,
  reviewChanges,
} from "./managed-workspace";
import type { TrialSession } from "./session";
import { response as annualResponse } from "../features/research/sec-annual-evidence-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { annualNoteExcerpt } from "./managed-annual-note";
import { priceComparisonNoteExcerpt } from "./managed-price-note";
import { normalizeWatchlistNote } from "@research-cockpit/contracts";

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
    eodHistory: vi.fn(),
    annualReport: vi.fn(),
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
  workspace.setView("discover");
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

  it("recovers a failed startup catalog read explicitly without reloading or saving the draft", async () => {
    const { workspace, api, session } = fixture({
      ...empty,
      memberships: [listingMembership(result), listingMembership(second)],
    });
    vi.mocked(api.status).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await Promise.all([
      workspace.coordinator.load(),
      workspace.refreshCatalog(),
    ]);
    expect(workspace.getSnapshot()).toMatchObject({
      read: null,
      snapshot: null,
      message:
        "The catalog could not be loaded. Select Refresh catalog to try again.",
    });
    workspace.note(result.listingId, "Keep my unsaved thesis");
    workspace.move(second.listingId, -1);
    workspace.setQuery("Invented");
    const draft = workspace.coordinator.getSnapshot().draft;
    const held = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
    vi.mocked(api.status).mockReturnValueOnce(held.promise);
    const refresh = workspace.refreshCatalog();
    expect(workspace.getSnapshot()).toMatchObject({
      read: "status",
      query: "Invented",
      message: "",
    });
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      draft,
      dirty: true,
      uncertain: false,
    });
    held.resolve({ snapshot });
    await refresh;
    expect(workspace.getSnapshot()).toMatchObject({
      read: null,
      query: "Invented",
      snapshot,
      message: "",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    await workspace.search();
    expect(workspace.getSnapshot().results).toEqual([result, second]);
    expect(api.status).toHaveBeenCalledTimes(2);
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.search).toHaveBeenCalledExactlyOnceWith(
      "Invented",
      expect.any(AbortSignal),
    );
    for (const unused of [
      api.save,
      api.resolve,
      api.annualReport,
      session.getToken,
      session.signOut,
    ])
      expect(unused).not.toHaveBeenCalled();
  });

  it.each([
    [
      "status",
      "The catalog could not be loaded. Select Refresh catalog to try again.",
    ],
    [
      "search",
      "The search could not be completed. Select Search to try again.",
    ],
    [
      "resolve",
      "The catalog review could not be completed. Select Review catalog changes to try again.",
    ],
  ] as const)(
    "keeps %s failure recovery specific without changing the draft or claiming an outage",
    async (action, message) => {
      const { workspace, api } = fixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      await ready(workspace);
      workspace.note(result.listingId, "unsaved");
      const draft = workspace.coordinator.getSnapshot().draft;
      for (const error of [
        new TrialApiError("unavailable"),
        new Error("unrecognized response"),
      ]) {
        vi.mocked(api[action]).mockRejectedValueOnce(error);
        if (action === "status") await workspace.refreshCatalog();
        else if (action === "search") await workspace.search();
        else await workspace.reviewCatalog();
        expect(workspace.getSnapshot()).toMatchObject({
          read: null,
          reviewing: false,
          message,
          snapshot,
        });
        expect(workspace.coordinator.getSnapshot()).toMatchObject({
          dirty: true,
          uncertain: false,
          phase: "idle",
        });
        expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      }
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["status", "search", "resolve"] as const)(
    "attributes an invalid %s request to the actual operation",
    async (action) => {
      const { workspace, api } = fixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      await ready(workspace);
      vi.mocked(api[action]).mockRejectedValueOnce(
        new TrialApiError("invalid_request"),
      );
      if (action === "status") await workspace.refreshCatalog();
      else if (action === "search") await workspace.search();
      else await workspace.reviewCatalog();
      if (action === "search")
        expect(workspace.getSnapshot().message).toBe(
          "Enter a company name or ticker of at most 128 characters.",
        );
      else
        expect(workspace.getSnapshot().message).not.toContain("128 characters");
    },
  );

  it.each(["status", "search"] as const)(
    "lets a query edit cancel a pending %s read without replacing the draft",
    async (action) => {
      const { workspace, api } = fixture();
      await ready(workspace);
      const held = deferred<never>();
      vi.mocked(api[action]).mockReturnValueOnce(held.promise);
      const draft = workspace.coordinator.getSnapshot().draft;
      const pending =
        action === "status" ? workspace.refreshCatalog() : workspace.search();
      expect(workspace.getSnapshot().read).toBe(action);
      const call = vi.mocked(api[action]).mock.calls.at(-1)!;
      const signal = call.at(-1) as AbortSignal;
      workspace.setQuery("replacement");
      expect(signal.aborted).toBe(true);
      const afterEdit = workspace.getSnapshot();
      expect(afterEdit).toMatchObject({
        read: null,
        query: "replacement",
        message: "",
      });
      held.reject(new TrialApiError("unavailable"));
      await pending;
      expect(workspace.getSnapshot()).toBe(afterEdit);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    },
  );

  it.each(["success", "failure"] as const)(
    "ignores a replaced catalog read's late %s while a Search is pending",
    async (completion) => {
      const { workspace, api } = fixture();
      const old = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
      const current = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
      vi.mocked(api.status).mockReturnValueOnce(old.promise);
      vi.mocked(api.search).mockReturnValueOnce(current.promise);
      const stale = workspace.refreshCatalog();
      const pending = workspace.search();
      const beforeLateCompletion = workspace.getSnapshot();
      expect(beforeLateCompletion.read).toBe("search");
      expect(vi.mocked(api.status).mock.calls[0]![0].aborted).toBe(true);
      if (completion === "success") old.resolve({ snapshot });
      else old.reject(new TrialApiError("unavailable"));
      await stale;
      expect(workspace.getSnapshot()).toBe(beforeLateCompletion);
      current.reject(new TrialApiError("unavailable"));
      await pending;
      expect(workspace.getSnapshot()).toMatchObject({
        read: null,
        message:
          "The search could not be completed. Select Search to try again.",
      });
    },
  );

  it.each(["success", "failure"] as const)(
    "ignores a retired catalog read's late %s",
    async (completion) => {
      const { workspace, api } = fixture();
      const held = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
      vi.mocked(api.status).mockReturnValueOnce(held.promise);
      const pending = workspace.refreshCatalog();
      workspace.coordinator.retire();
      const retired = workspace.getSnapshot();
      if (completion === "success") held.resolve({ snapshot });
      else held.reject(new TrialApiError("unavailable"));
      await pending;
      expect(workspace.getSnapshot()).toBe(retired);
      expect(retired).toMatchObject({
        read: null,
        snapshot: null,
        message: "",
      });
    },
  );

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
      read: null,
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

  it.each(["status", "search", "resolve"] as const)(
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
      if (operation === "status") await workspace.refreshCatalog();
      else if (operation === "search") await workspace.search();
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

describe("annual panel within the managed workspace", () => {
  it("opens EOD only for current identities and keeps Annual mutually exclusive without automatic reads", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openDiscoveryEod(result);
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    await workspace.search();
    const found = workspace.getSnapshot().results[0]!;
    workspace.openDiscoveryAnnual(found);
    workspace.openDiscoveryEod(found);
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(workspace.eod.getSnapshot().selection?.listing.symbol).toBe("DEMO");
    workspace.openWatchlistEod(listingMembership(found));
    expect(workspace.eod.getSnapshot().selection?.origin).toBe("discover");
    workspace.add(found);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    workspace.openWatchlistEod(member);
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(workspace.eod.getSnapshot().selection?.origin).toBe("watchlist");
    workspace.openDiscoveryAnnual(found);
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
  });
  it("keeps EOD selection across note/order edits but clears it when the exact watchlist identity changes", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result), listingMembership(second)],
    });
    await ready(workspace);
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const selection = workspace.eod.getSnapshot().selection;
    workspace.note(result.listingId, "EOD unsaved note");
    workspace.move(result.listingId, 1);
    expect(workspace.eod.getSnapshot().selection).toBe(selection);
    const draft = workspace.coordinator.getSnapshot().draft!;
    workspace.coordinator.replaceDraft({
      ...draft,
      memberships: draft.memberships.map((member) =>
        member.listingId === result.listingId
          ? { ...member, securityId: "replacement-security" }
          : member,
      ),
    });
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toBe("EOD unsaved note");
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
  });
  it.each(["catalog", "remove", "annual", "retire"])(
    "aborts pending EOD on %s and rejects its late response",
    async (cause) => {
      const { workspace, api } = fixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      await ready(workspace);
      const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      workspace.openWatchlistEod(member);
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValue(held.promise);
      const pending = workspace.eod.load();
      if (cause === "catalog") {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
        expect(workspace.canOpenWatchlistEod(member)).toBe(false);
      } else if (cause === "remove") workspace.remove(member.listingId);
      else if (cause === "annual") workspace.openWatchlistAnnual(member);
      else workspace.coordinator.retire();
      expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(true);
      held.resolve(eodResponse());
      await pending;
      expect(workspace.eod.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
      });
      expect(api.save).not.toHaveBeenCalled();
    },
  );
  it("routes current EOD authentication loss through shared retirement", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    vi.mocked(api.eodHistory).mockRejectedValue(
      new TrialApiError("access_denied"),
    );
    await workspace.eod.load();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
  });
  it("opens only a captured current result or current watchlist membership, without an automatic request", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openDiscoveryAnnual(result);
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    await workspace.search();
    const found = workspace.getSnapshot().results[0]!;
    workspace.openDiscoveryAnnual(found);
    expect(workspace.annual.getSnapshot().selection?.listing.symbol).toBe(
      "DEMO",
    );
    expect(api.annualReport).not.toHaveBeenCalled();
    workspace.closeResearch();
    workspace.openWatchlistAnnual(listingMembership(result));
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    workspace.add(found);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    expect(workspace.annual.getSnapshot().selection?.origin).toBe("watchlist");
    expect(api.annualReport).not.toHaveBeenCalled();
  });

  it("keeps notes, order and dirty state through annual selection and Back; identity removal clears selection", async () => {
    const initial = {
      ...empty,
      memberships: [listingMembership(result), listingMembership(second)],
    };
    const { workspace } = fixture(initial);
    await ready(workspace);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const selected = workspace.annual.getSnapshot().selection;
    workspace.note(result.listingId, "Still my unsaved note");
    workspace.move(result.listingId, 1);
    expect(workspace.annual.getSnapshot().selection).toBe(selected);
    workspace.closeResearch();
    const saved = workspace.coordinator.getSnapshot();
    expect(saved.dirty).toBe(true);
    expect(saved.draft!.memberships[1]!.note).toBe("Still my unsaved note");
    workspace.openWatchlistAnnual(saved.draft!.memberships[1]!);
    workspace.remove(result.listingId);
    expect(workspace.annual.getSnapshot().selection).toBeNull();
  });

  it("rejects stale watchlist opening and cancels a report when the catalog changes", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    await ready(workspace);
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    vi.mocked(api.annualReport).mockReturnValue(held.promise);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const loading = workspace.annual.load();
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: nextDigest },
    });
    await workspace.refreshCatalog();
    expect(vi.mocked(api.annualReport).mock.calls[0]![1].aborted).toBe(true);
    held.resolve(await annualResponse());
    await loading;
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    expect(workspace.canOpenWatchlistAnnual(member)).toBe(false);
    workspace.openWatchlistAnnual(member);
    expect(workspace.annual.getSnapshot().selection).toBeNull();
  });

  it("routes annual authentication loss through shared retirement and clears the entire workspace", async () => {
    const { workspace, api } = fixture({
      ...empty,
      memberships: [{ ...listingMembership(result), note: "Private note" }],
    });
    await ready(workspace);
    workspace.setQuery("Private company search");
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    vi.mocked(api.annualReport).mockRejectedValue(
      new TrialApiError("unauthenticated"),
    );
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(workspace.getSnapshot().query).toBe("");
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
  });
});

describe("company research watchlist draft", () => {
  async function researchFixture(initial = empty) {
    const setup = fixture(initial);
    await ready(setup.workspace);
    setup.workspace.openDiscoveryAnnual(result);
    const selection = setup.workspace.getSnapshot().research!.selection;
    return { ...setup, selection };
  }

  it("adds only the captured company draft, shares its note and explicitly saves and reloads the full list", async () => {
    const initial = {
      ...empty,
      memberships: [{ ...listingMembership(second), note: "Other research" }],
    };
    const { workspace, api, session, saved, selection } =
      await researchFixture(initial);
    const visit = workspace.getSnapshot().research;
    workspace.setQuery("A new query without searching");
    expect(workspace.getResearchWatchlist(selection)).toEqual({
      member: null,
      canAdd: true,
      canEdit: false,
      reason: null,
    });
    workspace.noteResearch(selection, "Must not add implicitly");
    expect(workspace.coordinator.getSnapshot().draft).toEqual(initial);
    workspace.addResearchToWatchlist(selection);
    workspace.addResearchToWatchlist(selection);
    expect(workspace.getSnapshot().research).toBe(visit);
    expect(workspace.getResearchWatchlist(selection).member).toEqual(
      listingMembership(result),
    );
    workspace.noteResearch(selection, "  Cafe\u0301 thesis  ");
    workspace.switchToEod();
    expect(workspace.getSnapshot().research!.selection).toBe(selection);
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      "  Cafe\u0301 thesis  ",
    );
    workspace.note(result.listingId, "  Shared workspace note  ");
    workspace.switchToAnnual();
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      "  Shared workspace note  ",
    );
    expect(workspace.coordinator.getSnapshot().draft?.memberships[0]).toEqual(
      initial.memberships[0],
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.search).toHaveBeenCalledOnce();
    workspace.setView("watchlist");
    expect(workspace.getSnapshot().research).toBeNull();
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships).toEqual([
      initial.memberships[0],
      { ...listingMembership(result), note: "Shared workspace note" },
    ]);
    const reopened = new ManagedWorkspace(api, session);
    await reopened.coordinator.load();
    await reopened.refreshCatalog();
    reopened.openWatchlistAnnual(
      reopened.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    expect(
      reopened.getResearchWatchlist(reopened.getSnapshot().research!.selection)
        .member?.note,
    ).toBe("Shared workspace note");
  });

  it("keeps equal tickers on different listings and share classes as separate notes", async () => {
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
    workspace.openDiscoveryAnnual(result);
    const first = workspace.getSnapshot().research!.selection;
    workspace.addResearchToWatchlist(first);
    workspace.noteResearch(first, "Class A thesis");
    workspace.openDiscoveryAnnual(alternate);
    const next = workspace.getSnapshot().research!.selection;
    workspace.addResearchToWatchlist(next);
    workspace.noteResearch(next, "Class B thesis");
    workspace.noteResearch(first, "Old visit must not write");
    expect(workspace.coordinator.getSnapshot().draft?.memberships).toEqual([
      { ...listingMembership(result), note: "Class A thesis" },
      { ...listingMembership(alternate), note: "Class B thesis" },
    ]);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["copy", "reopen", "other", "close", "retire", "catalog"])(
    "rejects captured actions after %s without touching the current draft",
    async (boundary) => {
      const { workspace, api, selection } = await researchFixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      let captured = selection;
      if (boundary === "copy") captured = { ...selection };
      else if (boundary === "reopen") {
        workspace.closeResearch();
        workspace.openDiscoveryAnnual(result);
        expect(workspace.getSnapshot().research!.selection).not.toBe(selection);
      } else if (boundary === "other") workspace.openDiscoveryAnnual(second);
      else if (boundary === "close") workspace.closeResearch();
      else if (boundary === "retire") workspace.coordinator.retire();
      else {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getResearchWatchlist(captured)).toMatchObject({
        canAdd: false,
        canEdit: false,
        reason: "Open this company again before editing its watchlist note.",
      });
      workspace.noteResearch(captured, "Rejected old callback");
      workspace.addResearchToWatchlist(captured);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
    },
  );

  it.each([
    "shareClassId",
    "securityId",
    "issuerId",
    "exchangeMic",
    "symbol",
  ] as const)(
    "blocks a same-listing-ID %s mismatch instead of adding or editing another identity",
    async (field) => {
      const { workspace, selection } = await researchFixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      const draft = workspace.coordinator.getSnapshot().draft!;
      workspace.coordinator.replaceDraft({
        ...draft,
        memberships: [
          { ...draft.memberships[0]!, [field]: "changed-identity" },
        ],
      });
      const changed = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getResearchWatchlist(selection)).toEqual({
        member: null,
        canAdd: false,
        canEdit: false,
        reason: "Review this listing's changed identity in My Watchlist.",
      });
      workspace.noteResearch(selection, "Do not overwrite");
      workspace.addResearchToWatchlist(selection);
      expect(workspace.coordinator.getSnapshot().draft).toBe(changed);
    },
  );

  it("requires a loaded watchlist and matching catalog before any draft action", async () => {
    const { workspace, api } = fixture();
    await workspace.refreshCatalog();
    workspace.setQuery("Invented");
    await workspace.search();
    workspace.openDiscoveryAnnual(result);
    const selection = workspace.getSnapshot().research!.selection;
    expect(workspace.getResearchWatchlist(selection).reason).toBe(
      "Load My Watchlist before adding or editing a note.",
    );
    workspace.addResearchToWatchlist(selection);
    workspace.noteResearch(selection, "Blocked");
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    vi.mocked(api.load).mockResolvedValue({
      version: 1,
      payload: { ...empty, snapshotSha256: nextDigest },
    });
    await workspace.coordinator.load();
    const stale = workspace.coordinator.getSnapshot().draft;
    expect(workspace.getResearchWatchlist(selection).reason).toBe(
      "Review catalog changes in My Watchlist before editing.",
    );
    workspace.addResearchToWatchlist(selection);
    workspace.noteResearch(selection, "Blocked");
    expect(workspace.coordinator.getSnapshot().draft).toBe(stale);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["loading", "saving"])(
    "keeps a matching note readable but blocks changes while %s",
    async (phase) => {
      const { workspace, api, selection } = await researchFixture({
        ...empty,
        memberships: [{ ...listingMembership(result), note: "Keep this" }],
      });
      const held = deferred<never>();
      if (phase === "saving") {
        workspace.noteResearch(selection, "Draft to save");
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
      } else vi.mocked(api.load).mockReturnValueOnce(held.promise);
      const pending =
        phase === "saving"
          ? workspace.coordinator.save()
          : workspace.coordinator.load();
      const draft = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getResearchWatchlist(selection)).toMatchObject({
        member: draft!.memberships[0],
        canAdd: false,
        canEdit: false,
        reason:
          "Wait for the current My Watchlist operation to finish before editing.",
      });
      workspace.noteResearch(selection, "Blocked");
      workspace.addResearchToWatchlist(selection);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      held.reject(new TrialApiError("unavailable"));
      await pending;
    },
  );

  it.each(["conflict", "commit_unknown"] as const)(
    "blocks both absent-company Add and shared-note edits after %s",
    async (failure) => {
      const { workspace, api, selection } = await researchFixture();
      workspace.add(second);
      vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError(failure));
      await workspace.coordinator.save();
      const draft = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getResearchWatchlist(selection)).toMatchObject({
        canAdd: false,
        canEdit: false,
      });
      workspace.addResearchToWatchlist(selection);
      workspace.openDiscoveryAnnual(second);
      const secondSelection = workspace.getSnapshot().research!.selection;
      expect(workspace.getResearchWatchlist(secondSelection)).toMatchObject({
        member: draft!.memberships[0],
        canAdd: false,
        canEdit: false,
      });
      workspace.noteResearch(secondSelection, "Blocked");
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.save).toHaveBeenCalledOnce();
      if (failure === "commit_unknown") {
        const held = deferred<never>();
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
        const pending = workspace.coordinator.reconcile();
        expect(workspace.getResearchWatchlist(secondSelection).reason).toBe(
          "Review the pending save in My Watchlist before editing.",
        );
        workspace.noteResearch(secondSelection, "Still blocked");
        expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
    },
  );

  it("blocks Add at the membership limit without blocking an existing note", async () => {
    const memberships = Array.from({ length: 10_000 }, (_, index) => ({
      ...listingMembership(result),
      listingId: `saved-${index}`,
    }));
    const { workspace, selection } = await researchFixture({
      ...empty,
      memberships,
    });
    expect(workspace.getResearchWatchlist(selection).reason).toBe(
      "Remove an entry from My Watchlist before adding this company.",
    );
    workspace.addResearchToWatchlist(selection);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    const existing = workspace.getSnapshot().research!.selection;
    expect(workspace.getResearchWatchlist(existing).canEdit).toBe(true);
    workspace.noteResearch(existing, "Existing entry remains editable");
    expect(workspace.coordinator.getSnapshot().draft?.memberships).toHaveLength(
      10_000,
    );
    expect(workspace.getResearchWatchlist(existing).member?.note).toBe(
      "Existing entry remains editable",
    );
  });

  it("adds an admitted Markets selection without a search or another catalog resolve", async () => {
    const { api, session } = fixture();
    const cohort = [0, 1, 2].map((index) => ({
      ...eodSelection.listing,
      listingId: `market-listing-${index}`,
      symbol: `MARK${index}`,
      securityId: `market-security-${index}`,
      shareClassId: `market-class-${index}`,
    }));
    vi.mocked(api.resolve).mockResolvedValue({
      snapshotSha256: digest,
      results: cohort.map((listing) => ({
        listingId: listing.listingId,
        listing,
      })),
    });
    const workspace = new ManagedWorkspace(api, session, undefined, {
      marketsCohort: cohort,
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    expect(workspace.markets.getSnapshot().rows).toHaveLength(3);
    workspace.openMarketResearch("eod", cohort[1]!.listingId);
    const selection = workspace.getSnapshot().research!.selection;
    const board = workspace.markets.getSnapshot();
    workspace.addResearchToWatchlist(selection);
    workspace.noteResearch(selection, "Captured from the board");
    expect(workspace.getResearchWatchlist(selection).member).toEqual({
      ...cohort[1],
      note: "Captured from the board",
    });
    expect(workspace.getSnapshot().research!.selection).toBe(selection);
    expect(selection).toMatchObject({ origin: "markets", cik: null });
    expect(workspace.markets.getSnapshot()).toBe(board);
    expect(api.resolve).toHaveBeenCalledOnce();
    expect(api.search).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("keeps edits blocked after an uncertain save is replayed until the existing explicit recovery", async () => {
    const { workspace, api, selection } = await researchFixture({
      ...empty,
      memberships: [listingMembership(result)],
    });
    workspace.noteResearch(selection, "Captured note");
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
    await workspace.coordinator.reconcile();
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      replayPending: true,
      conflict: true,
      uncertain: false,
    });
    expect(workspace.getResearchWatchlist(selection)).toMatchObject({
      member: draft!.memberships[0],
      canAdd: false,
      canEdit: false,
      reason: "Review the pending save in My Watchlist before editing.",
    });
    workspace.noteResearch(selection, "Not yet allowed");
    workspace.addResearchToWatchlist(selection);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it.each(["remove", "replace"])(
    "fences a watchlist-origin note callback after membership %s",
    async (change) => {
      const { workspace } = await researchFixture({
        ...empty,
        memberships: [listingMembership(result)],
      });
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
      const selection = workspace.getSnapshot().research!.selection;
      if (change === "remove") workspace.remove(result.listingId);
      else
        workspace.coordinator.replaceDraft({
          ...empty,
          memberships: [
            { ...listingMembership(result), shareClassId: "replacement" },
          ],
        });
      const draft = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getSnapshot().research).toBeNull();
      workspace.noteResearch(selection, "Obsolete membership");
      workspace.addResearchToWatchlist(selection);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    },
  );

  it.each(["bad\u0000note", "x".repeat(2001)])(
    "keeps existing note validation on explicit Save %#",
    async (note) => {
      const { workspace, api, selection } = await researchFixture();
      workspace.addResearchToWatchlist(selection);
      workspace.noteResearch(selection, note);
      expect(workspace.getResearchWatchlist(selection).member?.note).toBe(note);
      await workspace.coordinator.save();
      expect(api.save).not.toHaveBeenCalled();
      expect(workspace.canSavePayload()).toBe(false);
    },
  );
});

describe("Markets price handoff", () => {
  const cohort = ["ALFA", "BETA", "BETB"].map((symbol, index) => ({
    ...eodSelection.listing,
    listingId: `market-listing-${index}`,
    symbol,
    securityId: `market-security-${index}`,
    shareClassId: `market-class-${index}`,
  }));
  const price = (index: number) => ({
    ...eodResponse(),
    security: cohort[index]!,
  });
  async function marketFixture() {
    const setup = fixture({
      ...empty,
      memberships: cohort.map((listing) => ({
        ...listing,
        note: "Original note",
      })),
    });
    vi.mocked(setup.api.resolve).mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: digest,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: cohort.find((entry) => entry.listingId === listingId)!,
        })),
      }),
    );
    vi.mocked(setup.api.eodHistory).mockImplementation((request) =>
      Promise.resolve(
        price(
          cohort.findIndex((entry) => entry.listingId === request.listingId),
        ),
      ),
    );
    const workspace = new ManagedWorkspace(
      setup.api,
      setup.session,
      undefined,
      {
        marketsCohort: cohort,
      },
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note(cohort[0]!.listingId, "Unsaved thesis");
    workspace.move(cohort[0]!.listingId, 1);
    return { ...setup, workspace };
  }

  it.each(["eod", "annual"] as const)(
    "carries a selected load through %s entry, note review and one explicit save",
    async (section) => {
      const { workspace, api, saved } = await marketFixture();
      await workspace.markets.loadSelected();
      const board = workspace.markets.getSnapshot();
      const original = board.rows[0]!.response!;
      const before = workspace.coordinator.getSnapshot().draft!;
      const observed = vi.fn(() => {
        const visit = workspace.getSnapshot().research;
        if (visit)
          expect(workspace[visit.section].getSnapshot().selection).toEqual(
            visit.selection,
          );
      });
      const disposers = [workspace, workspace.eod, workspace.annual].map(
        (model) => model.subscribe(observed),
      );
      workspace.openMarketResearch(section);
      const selection = workspace.getSnapshot().research!.selection;
      expect(selection).toMatchObject({
        origin: "markets",
        listing: cohort[0],
      });
      expect(workspace.annual.getSnapshot().response).toBeNull();
      workspace.switchToEod();
      const carried = workspace.eod.getSnapshot().response!;
      expect(carried).toEqual(original);
      expect(carried).not.toBe(original);
      expect(workspace.eod.getSnapshot()).toMatchObject({
        responseOrigin: "markets",
        showingPrevious: false,
        running: false,
      });
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          carried,
          carried.rows[0]!,
        ),
      ).toMatchObject({ appended: true });
      expect(api.save).not.toHaveBeenCalled();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      workspace.closeResearch();
      expect(workspace.markets.getSnapshot()).toBe(board);
      const draft = workspace.coordinator.getSnapshot().draft!;
      expect(draft.memberships.map((entry) => entry.listingId)).toEqual(
        before.memberships.map((entry) => entry.listingId),
      );
      expect(draft.memberships[0]).toEqual(before.memberships[0]);
      expect(draft.memberships[1]!.note).toContain("Unsaved thesis");
      expect(draft.memberships[1]!.note).toContain("2026-09-18");
      await workspace.coordinator.save();
      expect(api.save).toHaveBeenCalledOnce();
      expect(saved().payload).toEqual(draft);
      expect(observed).toHaveBeenCalled();
      disposers.forEach((dispose) => dispose());
    },
  );

  it.each([
    { index: 0, cancelFirst: false, previous: false },
    { index: 1, cancelFirst: false, previous: true },
    { index: 2, cancelFirst: false, previous: true },
    { index: 0, cancelFirst: true, previous: false },
    { index: 1, cancelFirst: true, previous: true },
    { index: 2, cancelFirst: true, previous: true },
  ])(
    "captures settled row $index, prior Cancel=$cancelFirst",
    async ({ index, cancelFirst, previous }) => {
      const { workspace, api } = await marketFixture();
      await workspace.markets.load();
      const held = deferred<ReturnType<typeof price>>();
      vi.mocked(api.eodHistory)
        .mockResolvedValueOnce(price(0))
        .mockReturnValueOnce(held.promise);
      const pending = workspace.markets.load();
      await vi.waitFor(() => expect(api.eodHistory).toHaveBeenCalledTimes(5));
      if (cancelFirst) workspace.markets.cancel();
      workspace.openMarketResearch("annual", cohort[index]!.listingId);
      const board = workspace.markets.getSnapshot();
      const carried = workspace.eod.getSnapshot();
      expect(vi.mocked(api.eodHistory).mock.calls[4]![1].aborted).toBe(true);
      expect(carried).toMatchObject({
        response: price(index),
        responseOrigin: "markets",
        showingPrevious: previous,
        running: false,
      });
      workspace.switchToEod();
      held.resolve(price(1));
      await pending;
      expect(workspace.eod.getSnapshot()).toBe(carried);
      expect(workspace.markets.getSnapshot()).toBe(board);
      expect(api.eodHistory).toHaveBeenCalledTimes(5);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "authentication", "catalog", "cooldown"] as const)(
    "fences a cancelled board refresh's late %s from the company visit",
    async (outcome) => {
      const { workspace, api } = await marketFixture();
      await workspace.markets.loadSelected();
      const held = deferred<ReturnType<typeof price>>();
      vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
      const pending = workspace.markets.loadSelected();
      workspace.openMarketResearch("eod");
      const visit = workspace.getSnapshot().research;
      const carried = workspace.eod.getSnapshot();
      if (outcome === "success") held.resolve(price(0));
      else if (outcome === "authentication")
        held.reject(new TrialApiError("unauthenticated"));
      else if (outcome === "catalog")
        held.reject(new ManagedCatalogChangedError());
      else
        held.reject(
          new ManagedEodCooldownError(
            new Date(Date.now() + 60_000).toISOString(),
          ),
        );
      await pending;
      expect(workspace.getSnapshot().research).toBe(visit);
      expect(workspace.eod.getSnapshot()).toBe(carried);
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      await workspace.eod.load();
      expect(api.eodHistory).toHaveBeenCalledTimes(3);
      expect(workspace.eod.getSnapshot().responseOrigin).toBe("company");
    },
  );

  it("preserves the shared checked cooldown through Annual-first entry and replaces only company prices on Refresh", async () => {
    const { workspace, api } = await marketFixture();
    await workspace.markets.loadSelected();
    const clock = vi.spyOn(Date, "now");
    const now = Date.now();
    clock.mockReturnValue(now);
    try {
      vi.mocked(api.eodHistory).mockRejectedValueOnce(
        new ManagedEodCooldownError(new Date(now + 60_000).toISOString()),
      );
      await workspace.markets.loadSelected();
      const board = workspace.markets.getSnapshot();
      workspace.openMarketResearch("annual");
      workspace.switchToEod();
      expect(workspace.eod.getSnapshot()).toMatchObject({
        response: price(0),
        responseOrigin: "markets",
        showingPrevious: true,
      });
      await workspace.eod.load();
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      clock.mockReturnValue(now + 60_001);
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      const fresh = { ...price(0), completedAt: "2026-09-20T00:00:02.000Z" };
      vi.mocked(api.eodHistory).mockResolvedValueOnce(fresh);
      await workspace.eod.load();
      expect(workspace.eod.getSnapshot()).toMatchObject({
        response: fresh,
        responseOrigin: "company",
        showingPrevious: false,
      });
      expect(api.eodHistory).toHaveBeenCalledTimes(3);
      workspace.closeResearch();
      expect(workspace.markets.getSnapshot()).toBe(board);
    } finally {
      clock.mockRestore();
    }
  });

  it("leaves a row without a response unloaded when opening research during a board load", async () => {
    const { workspace, api } = await marketFixture();
    const held = deferred<ReturnType<typeof price>>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
    const pending = workspace.markets.load();
    workspace.openMarketResearch("annual", cohort[2]!.listingId);
    workspace.switchToEod();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: null,
      responseOrigin: null,
      showingPrevious: false,
      running: false,
    });
    held.resolve(price(0));
    await pending;
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(api.eodHistory).toHaveBeenCalledOnce();
  });

  it.each(["discover", "watchlist", "route"] as const)(
    "does not reuse board prices on a separate %s visit",
    async (origin) => {
      const { workspace, api } = await marketFixture();
      await workspace.markets.loadSelected();
      workspace.openMarketResearch("eod");
      workspace.closeResearch();
      if (origin === "route") {
        await workspace.setCompanyRoute({
          kind: "company",
          listingId: cohort[0]!.listingId,
          section: "eod",
        });
      } else if (origin === "watchlist") {
        workspace.setView("watchlist");
        workspace.openWatchlistEod(
          workspace.coordinator.getSnapshot().draft!.memberships[1]!,
        );
      } else {
        workspace.setView("discover");
        const found = {
          ...cohort[0]!,
          cik: "0000000001",
          matchKind: "name_exact" as const,
          matchedValue: "ALFA",
        };
        vi.mocked(api.search).mockResolvedValue({
          snapshot,
          results: [found],
          totalMatches: 1,
          limitApplied: 25,
          normalizedQuery: "ALFA",
        });
        await workspace.search();
        workspace.openDiscoveryEod(found);
      }
      expect(workspace.eod.getSnapshot()).toMatchObject({
        response: null,
        responseOrigin: null,
      });
      expect(workspace.eod.getSnapshot().selection?.origin).toBe(origin);
      expect(api.eodHistory).toHaveBeenCalledOnce();
    },
  );

  it.each(["catalog", "retirement", "leave"] as const)(
    "clears the carried packet on %s",
    async (cause) => {
      const { workspace, api } = await marketFixture();
      await workspace.markets.loadSelected();
      workspace.openMarketResearch("annual");
      if (cause === "retirement") workspace.coordinator.retire();
      else if (cause === "leave") workspace.setView("discover");
      else {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      }
      expect(workspace.getSnapshot().research).toBeNull();
      expect(workspace.eod.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
        responseOrigin: null,
      });
      expect(api.eodHistory).toHaveBeenCalledOnce();
    },
  );
});

describe("company research visits", () => {
  const zero: PersonalSecurityMasterSearchResultDto = {
    ...eodSelection.listing,
    cik: "0000000001",
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  };
  async function navigationFixture(
    origin: "discover" | "watchlist",
    panel: "annual" | "eod" = "annual",
  ) {
    const setup = fixture({
      ...empty,
      memberships: [listingMembership(zero), listingMembership(second)],
    });
    const { workspace, api } = setup;
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [zero, second],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    vi.mocked(api.annualReport).mockResolvedValue(await annualResponse());
    vi.mocked(api.eodHistory).mockResolvedValue(eodResponse());
    await ready(workspace);
    workspace.note(zero.listingId, "Keep this unsaved thesis");
    workspace.move(zero.listingId, 1);
    if (origin === "discover") {
      if (panel === "annual") workspace.openDiscoveryAnnual(zero);
      else workspace.openDiscoveryEod(zero);
    } else {
      const member = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
      if (panel === "annual") workspace.openWatchlistAnnual(member);
      else workspace.openWatchlistEod(member);
    }
    return setup;
  }

  it.each(["discover", "watchlist"] as const)(
    "editing the shared note preserves loaded Price and Annual results from %s",
    async (origin) => {
      const { workspace, api } = await navigationFixture(origin);
      const selection = workspace.getSnapshot().research!.selection;
      await workspace.annual.load();
      workspace.switchToEod();
      await workspace.eod.load();
      const annual = workspace.annual.getSnapshot();
      const eod = workspace.eod.getSnapshot();
      const other = workspace.coordinator.getSnapshot().draft!.memberships[0];
      workspace.noteResearch(selection, "New evidence to follow up");
      workspace.switchToAnnual();
      workspace.switchToEod();
      expect(workspace.annual.getSnapshot()).toBe(annual);
      expect(workspace.eod.getSnapshot()).toBe(eod);
      expect(workspace.getSnapshot().research!.selection).toBe(selection);
      expect(selection.origin).toBe(origin);
      expect(selection.cik).toBe(origin === "discover" ? zero.cik : null);
      expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
        "New evidence to follow up",
      );
      expect(workspace.coordinator.getSnapshot().draft!.memberships[0]).toEqual(
        other,
      );
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    { origin: "discover", panel: "annual" },
    { origin: "discover", panel: "eod" },
    { origin: "watchlist", panel: "annual" },
    { origin: "watchlist", panel: "eod" },
  ] as const)(
    "switches from $origin $panel with the exact identity and no reads or writes",
    async ({ origin, panel }) => {
      const { workspace, api } = await navigationFixture(origin, panel);
      const selected = workspace[panel].getSnapshot().selection;
      const saved = workspace.coordinator.getSnapshot();
      expect(selected).toMatchObject({
        listing: eodSelection.listing,
        catalogSnapshotSha256: digest,
        cik: origin === "discover" ? zero.cik : null,
        origin,
      });
      if (panel === "annual") workspace.switchToEod();
      else workspace.switchToAnnual();
      const target = workspace[panel === "annual" ? "eod" : "annual"];
      expect(target.getSnapshot()).toMatchObject({
        selection: selected,
        response: null,
        running: false,
      });
      expect(Object.isFrozen(target.getSnapshot().selection?.listing)).toBe(
        true,
      );
      expect(workspace[panel].getSnapshot().selection).toBe(selected);
      expect(workspace.getSnapshot().research).toEqual({
        selection: selected,
        section: panel === "annual" ? "eod" : "annual",
      });
      expect(workspace.coordinator.getSnapshot()).toBe(saved);
      expect(saved.dirty).toBe(true);
      expect(saved.draft!.memberships[1]!.note).toBe(
        "Keep this unsaved thesis",
      );
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.search).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["discover", "watchlist"] as const)(
    "retains both exact loaded responses through repeated returns and the %s draft",
    async (origin) => {
      const { workspace, api } = await navigationFixture(origin);
      const draft = workspace.coordinator.getSnapshot().draft;
      const selection = workspace.getSnapshot().research!.selection;
      await workspace.annual.load();
      const annual = workspace.annual.getSnapshot().response;
      expect(annual).not.toBeNull();
      workspace.switchToEod();
      expect(workspace.annual.getSnapshot().response).toBe(annual);
      expect(workspace.eod.getSnapshot().response).toBeNull();
      await workspace.eod.load();
      const eod = workspace.eod.getSnapshot().response;
      expect(eod?.rows).toEqual(eodResponse().rows);
      const annualState = workspace.annual.getSnapshot();
      const eodState = workspace.eod.getSnapshot();
      for (let visit = 0; visit < 3; visit++) {
        workspace.switchToAnnual();
        expect(workspace.getSnapshot().research).toEqual({
          selection,
          section: "annual",
        });
        workspace.switchToEod();
        expect(workspace.getSnapshot().research).toEqual({
          selection,
          section: "eod",
        });
        expect(workspace.getSnapshot().research!.selection).toBe(selection);
        expect(workspace.annual.getSnapshot()).toBe(annualState);
        expect(workspace.eod.getSnapshot()).toBe(eodState);
      }
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod"] as const)(
    "keeps the admitted discovery identity after query edits from %s",
    async (panel) => {
      const { workspace, api } = await navigationFixture("discover", panel);
      const selected = workspace[panel].getSnapshot().selection;
      workspace.setQuery("A different company");
      expect(workspace.getSnapshot().results).toEqual([]);
      if (panel === "annual") workspace.switchToEod();
      else workspace.switchToAnnual();
      expect(
        workspace[panel === "annual" ? "eod" : "annual"].getSnapshot()
          .selection,
      ).toEqual(selected);
      expect(workspace.getSnapshot().query).toBe("A different company");
      expect(api.search).toHaveBeenCalledOnce();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod"] as const)(
    "selecting the active %s section leaves its pending explicit load alone",
    async (section) => {
      const { workspace, api } = await navigationFixture("discover", section);
      const held = deferred<never>();
      const read = section === "annual" ? api.annualReport : api.eodHistory;
      vi.mocked(read).mockReturnValueOnce(held.promise);
      const pending = workspace[section].load();
      const state = workspace[section].getSnapshot();
      const research = workspace.getSnapshot().research;
      if (section === "annual") workspace.switchToAnnual();
      else workspace.switchToEod();
      expect(workspace[section].getSnapshot()).toBe(state);
      expect(workspace.getSnapshot().research).toBe(research);
      expect(vi.mocked(read).mock.calls[0]![1].aborted).toBe(false);
      expect(read).toHaveBeenCalledOnce();
      workspace.closeResearch();
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
    },
  );

  it.each([
    { section: "annual", outcome: "success" },
    { section: "annual", outcome: "authentication" },
    { section: "annual", outcome: "catalog" },
    { section: "annual", outcome: "cooldown" },
    { section: "eod", outcome: "success" },
    { section: "eod", outcome: "authentication" },
    { section: "eod", outcome: "catalog" },
    { section: "eod", outcome: "cooldown" },
  ] as const)(
    "switching cancels $section refresh, keeps its prior response and fences late $outcome",
    async ({ section, outcome }) => {
      const { workspace, api } = await navigationFixture("discover", section);
      const model = workspace[section];
      const read = section === "annual" ? api.annualReport : api.eodHistory;
      await model.load();
      const previous = model.getSnapshot().response;
      const held = deferred<Awaited<ReturnType<typeof read>>>();
      if (section === "annual")
        vi.mocked(api.annualReport).mockImplementationOnce(
          async () =>
            held.promise as Promise<
              Awaited<ReturnType<ManagedApi["annualReport"]>>
            >,
        );
      else
        vi.mocked(api.eodHistory).mockImplementationOnce(
          async () =>
            held.promise as Promise<
              Awaited<ReturnType<ManagedApi["eodHistory"]>>
            >,
        );
      const pending = model.load();
      if (section === "annual") workspace.switchToEod();
      else workspace.switchToAnnual();
      expect(vi.mocked(read).mock.calls[1]![1].aborted).toBe(true);
      const retained = model.getSnapshot();
      expect(retained).toMatchObject({
        response: previous,
        showingPrevious: true,
        running: false,
      });
      const sibling = section === "annual" ? workspace.eod : workspace.annual;
      await sibling.load();
      const siblingState = sibling.getSnapshot();
      const visit = workspace.getSnapshot().research;
      if (outcome === "success")
        held.resolve(
          section === "annual" ? await annualResponse() : eodResponse(),
        );
      else if (outcome === "authentication")
        held.reject(new TrialApiError("unauthenticated"));
      else if (outcome === "catalog")
        held.reject(new ManagedCatalogChangedError());
      else {
        const nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
        held.reject(
          section === "annual"
            ? new ManagedAnnualCooldownError(nextAllowedAt)
            : new ManagedEodCooldownError(nextAllowedAt),
        );
      }
      await pending;
      expect(model.getSnapshot()).toBe(retained);
      expect(sibling.getSnapshot()).toBe(siblingState);
      expect(workspace.getSnapshot().research).toBe(visit);
      expect(workspace.getSnapshot().snapshot).toBe(snapshot);
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      if (section === "annual") workspace.switchToAnnual();
      else workspace.switchToEod();
      expect(model.getSnapshot().response).toBe(previous);
      expect(model.getSnapshot().showingPrevious).toBe(true);
      expect(read).toHaveBeenCalledTimes(2);
      await model.load();
      expect(read).toHaveBeenCalledTimes(3);
      expect(model.getSnapshot().showingPrevious).toBe(false);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "back",
    "same navigation",
    "other navigation",
    "catalog",
    "membership",
    "removal",
    "watchlist catalog",
    "retirement",
  ] as const)(
    "%s clears both loaded sections and fences a pending refresh",
    async (cause) => {
      const { workspace, api } = await navigationFixture("watchlist");
      await workspace.annual.load();
      workspace.switchToEod();
      await workspace.eod.load();
      const draft = workspace.coordinator.getSnapshot().draft;
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
      const pending = workspace.eod.load();
      if (cause === "back") workspace.closeResearch();
      else if (cause === "same navigation") workspace.setView("discover");
      else if (cause === "other navigation") workspace.setView("watchlist");
      else if (cause === "catalog") {
        vi.mocked(api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      } else if (cause === "membership") {
        workspace.coordinator.replaceDraft({
          ...draft!,
          memberships: draft!.memberships.map((member) =>
            member.listingId === zero.listingId
              ? { ...member, shareClassId: "replacement-class" }
              : member,
          ),
        });
      } else if (cause === "removal") workspace.remove(zero.listingId);
      else if (cause === "watchlist catalog")
        workspace.coordinator.replaceDraft({
          ...draft!,
          snapshotSha256: nextDigest,
        });
      else workspace.coordinator.retire();
      expect(vi.mocked(api.eodHistory).mock.calls[1]![1].aborted).toBe(true);
      expect(workspace.getSnapshot().research).toBeNull();
      for (const model of [workspace.annual, workspace.eod])
        expect(model.getSnapshot()).toMatchObject({
          selection: null,
          response: null,
          running: false,
        });
      held.resolve(eodResponse());
      await pending;
      workspace.switchToAnnual();
      workspace.switchToEod();
      expect(workspace.getSnapshot().research).toBeNull();
      expect(workspace.eod.getSnapshot().response).toBeNull();
      if (
        ["back", "same navigation", "other navigation", "catalog"].includes(
          cause,
        )
      )
        expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod"] as const)(
    "current %s authentication or catalog refusal clears the loaded sibling",
    async (section) => {
      for (const error of [
        new TrialApiError("access_denied"),
        new ManagedCatalogChangedError(),
      ]) {
        const { workspace, api } = await navigationFixture("discover");
        await workspace.annual.load();
        workspace.switchToEod();
        await workspace.eod.load();
        if (section === "annual") workspace.switchToAnnual();
        const read = section === "annual" ? api.annualReport : api.eodHistory;
        vi.mocked(read).mockRejectedValueOnce(error);
        await workspace[section].load();
        expect(workspace.getSnapshot().research).toBeNull();
        expect(workspace.annual.getSnapshot().response).toBeNull();
        expect(workspace.eod.getSnapshot().response).toBeNull();
        expect(workspace.coordinator.getSnapshot().phase).toBe(
          error instanceof TrialApiError ? "retired" : "idle",
        );
        expect(api.save).not.toHaveBeenCalled();
      }
    },
  );

  it("an unsupported Price section preserves loaded Annual evidence for the same visit", async () => {
    const { workspace, api } = await navigationFixture("watchlist");
    await workspace.annual.load();
    const annual = workspace.annual.getSnapshot();
    workspace.switchToEod();
    vi.mocked(api.eodHistory).mockRejectedValueOnce(
      new ManagedEodHistoryError("unsupported_listing"),
    );
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: null,
      error: true,
    });
    workspace.switchToAnnual();
    expect(workspace.annual.getSnapshot()).toBe(annual);
    expect(workspace.getSnapshot().research?.section).toBe("annual");
    expect(api.annualReport).toHaveBeenCalledOnce();
  });

  it("a new share-class visit starts unloaded and cannot inherit the previous company's late refresh", async () => {
    const { workspace, api } = await navigationFixture("discover");
    await workspace.annual.load();
    workspace.switchToEod();
    await workspace.eod.load();
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
    const pending = workspace.eod.load();
    const other = {
      ...zero,
      listingId: "listing-zero-b",
      securityId: "security-zero-b",
      symbol: "ZERB",
      shareClassId: "class-zero-b",
      shareClassName: "Class B",
    };
    vi.mocked(api.search).mockResolvedValueOnce({
      snapshot,
      results: [zero, other],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    await workspace.search();
    workspace.openDiscoveryAnnual(other);
    const visit = workspace.getSnapshot().research;
    expect(visit).toMatchObject({
      section: "annual",
      selection: {
        listing: {
          listingId: other.listingId,
          issuerId: zero.issuerId,
          shareClassId: other.shareClassId,
          symbol: other.symbol,
        },
        cik: zero.cik,
      },
    });
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
    });
    expect(vi.mocked(api.eodHistory).mock.calls[1]![1].aborted).toBe(true);
    held.resolve(eodResponse());
    await pending;
    workspace.switchToEod();
    expect(workspace.getSnapshot().research!.selection).toBe(visit!.selection);
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: null,
      selection: {
        listing: {
          listingId: other.listingId,
          shareClassId: other.shareClassId,
        },
        cik: zero.cik,
      },
    });
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
  });

  it("closing and reopening the same listing starts a fresh unloaded visit", async () => {
    const { workspace, api } = await navigationFixture("discover");
    const initial = workspace.getSnapshot().research!.selection;
    await workspace.annual.load();
    workspace.switchToEod();
    await workspace.eod.load();
    workspace.closeResearch();
    workspace.openDiscoveryAnnual(zero);
    expect(workspace.getSnapshot().research!.selection).not.toBe(initial);
    expect(workspace.annual.getSnapshot().response).toBeNull();
    workspace.switchToEod();
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).toHaveBeenCalledOnce();
  });

  it("publishes only visits whose active model has the captured identity", async () => {
    const { workspace } = await navigationFixture("discover");
    const observed = vi.fn(() => {
      const visit = workspace.getSnapshot().research;
      if (visit)
        expect(workspace[visit.section].getSnapshot().selection).toEqual(
          visit.selection,
        );
    });
    const disposers = [workspace, workspace.annual, workspace.eod].map(
      (model) => model.subscribe(observed),
    );
    workspace.switchToEod();
    workspace.switchToAnnual();
    workspace.closeResearch();
    workspace.openDiscoveryEod(zero);
    workspace.coordinator.retire();
    expect(observed).toHaveBeenCalled();
    disposers.forEach((dispose) => dispose());
  });

  it("retains the discovery CIK check after an EOD-to-Annual switch", async () => {
    const { workspace, api } = await navigationFixture("discover", "eod");
    workspace.switchToAnnual();
    const response = await annualResponse();
    vi.mocked(api.annualReport).mockResolvedValue({
      ...response,
      security: { ...response.security, cik: "0000000002" },
    });
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: null,
      error: true,
    });
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it.each(["success", "authentication failure"])(
    "aborts Annual before EOD opens and fences late Annual %s",
    async (outcome) => {
      const { workspace, api } = await navigationFixture("discover");
      const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
      vi.mocked(api.annualReport).mockReturnValue(held.promise);
      const pending = workspace.annual.load();
      const onOpen = vi.fn(() => {
        if (workspace.eod.getSnapshot().selection) {
          expect(vi.mocked(api.annualReport).mock.calls[0]![1].aborted).toBe(
            true,
          );
          expect(workspace.annual.getSnapshot().selection).not.toBeNull();
        }
      });
      const unsubscribe = workspace.eod.subscribe(onOpen);
      workspace.switchToEod();
      expect(onOpen).toHaveBeenCalled();
      unsubscribe();
      await workspace.eod.load();
      const current = workspace.eod.getSnapshot();
      if (outcome === "success") held.resolve(await annualResponse());
      else held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.eod.getSnapshot()).toBe(current);
      expect(workspace.annual.getSnapshot().response).toBeNull();
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "authentication failure"])(
    "aborts EOD before Annual opens and fences late EOD %s",
    async (outcome) => {
      const { workspace, api } = await navigationFixture("watchlist", "eod");
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValue(held.promise);
      const pending = workspace.eod.load();
      const onOpen = vi.fn(() => {
        if (workspace.annual.getSnapshot().selection) {
          expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(
            true,
          );
          expect(workspace.eod.getSnapshot().selection).not.toBeNull();
        }
      });
      const unsubscribe = workspace.annual.subscribe(onOpen);
      workspace.switchToAnnual();
      expect(onOpen).toHaveBeenCalled();
      unsubscribe();
      await workspace.annual.load();
      const current = workspace.annual.getSnapshot();
      if (outcome === "success") held.resolve(eodResponse());
      else held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.annual.getSnapshot()).toBe(current);
      expect(workspace.eod.getSnapshot().response).toBeNull();
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod"] as const)(
    "does not escape a %s catalog-change refusal through switching",
    async (panel) => {
      const { workspace, api } = await navigationFixture("discover", panel);
      if (panel === "annual")
        vi.mocked(api.annualReport).mockRejectedValue(
          new ManagedCatalogChangedError(),
        );
      else
        vi.mocked(api.eodHistory).mockRejectedValue(
          new ManagedCatalogChangedError(),
        );
      await workspace[panel].load();
      const refused = workspace[panel].getSnapshot();
      expect(refused.selection).toBeNull();
      expect(workspace.getSnapshot().snapshot).toBeNull();
      expect(workspace.getSnapshot().message).toContain("The catalog changed.");
      if (panel === "annual") workspace.switchToEod();
      else workspace.switchToAnnual();
      expect(workspace[panel].getSnapshot()).toBe(refused);
      expect(
        workspace[panel === "annual" ? "eod" : "annual"].getSnapshot()
          .selection,
      ).toBeNull();
    },
  );

  it.each(["catalog", "membership", "retirement"])(
    "cannot reopen either panel after %s invalidates the selection",
    async (cause) => {
      const { workspace, api } = await navigationFixture("watchlist", "eod");
      if (cause === "catalog") {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      } else if (cause === "membership") {
        const draft = workspace.coordinator.getSnapshot().draft!;
        workspace.coordinator.replaceDraft({
          ...draft,
          memberships: draft.memberships.map((member) =>
            member.listingId === zero.listingId
              ? { ...member, shareClassId: "other-share-class" }
              : member,
          ),
        });
      } else workspace.coordinator.retire();
      workspace.switchToAnnual();
      workspace.switchToEod();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.eod.getSnapshot().selection).toBeNull();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod"] as const)(
    "keeps %s cooldown across a round trip without automatic retry",
    async (panel) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
      try {
        const { workspace, api } = await navigationFixture("discover", panel);
        const nextAllowedAt = "2026-10-03T00:00:20.000Z";
        if (panel === "annual")
          vi.mocked(api.annualReport).mockRejectedValueOnce(
            new ManagedAnnualCooldownError(nextAllowedAt),
          );
        else
          vi.mocked(api.eodHistory).mockRejectedValueOnce(
            new ManagedEodCooldownError(nextAllowedAt),
          );
        await workspace[panel].load();
        if (panel === "annual") {
          workspace.switchToEod();
          workspace.switchToAnnual();
        } else {
          workspace.switchToAnnual();
          workspace.switchToEod();
        }
        await workspace[panel].load();
        const read = panel === "annual" ? api.annualReport : api.eodHistory;
        expect(read).toHaveBeenCalledOnce();
        expect(workspace[panel].getSnapshot().message).toContain(nextAllowedAt);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(read).toHaveBeenCalledOnce();
        await workspace[panel].load();
        expect(read).toHaveBeenCalledTimes(2);
        expect(api.save).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe("catalog-resolved company links", () => {
  const listing = eodSelection.listing;
  const alternate = {
    ...listing,
    listingId: "listing-zero-b",
    securityId: "security-zero-b",
    shareClassId: "class-zero-b",
    shareClassName: "Class B",
  };
  const route = (
    listingId = listing.listingId,
    section: "annual" | "eod" = "eod",
  ) => ({ kind: "company" as const, listingId, section });
  function linkedFixture() {
    const setup = fixture({
      ...empty,
      memberships: [{ ...listing, note: "original draft" }],
    });
    vi.mocked(setup.api.resolve).mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            [listing, alternate].find((item) => item.listingId === listingId) ??
            null,
        })),
      }),
    );
    vi.mocked(setup.api.eodHistory).mockResolvedValue(eodResponse());
    return setup;
  }
  it("publishes resolved visit and route together without a transient close notification", async () => {
    const { workspace } = linkedFixture();
    await workspace.refreshCatalog();
    const states: ReturnType<ManagedWorkspace["getSnapshot"]>[] = [];
    workspace.subscribe(() => states.push(workspace.getSnapshot()));
    await workspace.setCompanyRoute(route());
    expect(states.map((state) => state.companyRoute?.status)).toEqual([
      "waiting_catalog",
      "resolving",
      "open",
    ]);
    expect(states.at(-1)?.research?.selection.origin).toBe("route");
    workspace.closeResearch();
    expect(states.at(-1)).toMatchObject({ research: null, companyRoute: null });
  });
  it("waits for the initial catalog then resolves full identity once without loading research or saving", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.coordinator.load();
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().companyRoute?.status).toBe(
      "waiting_catalog",
    );
    expect(api.resolve).not.toHaveBeenCalled();
    await workspace.refreshCatalog();
    expect(api.resolve).toHaveBeenCalledExactlyOnceWith(
      { snapshotSha256: digest, listingIds: [listing.listingId] },
      expect.any(AbortSignal),
    );
    expect(workspace.getSnapshot().research).toMatchObject({
      section: "eod",
      selection: {
        listing,
        origin: "route",
        cik: null,
        catalogSnapshotSha256: digest,
      },
    });
    expect(workspace.getSnapshot().companyRoute?.status).toBe("open");
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("retains the selected class, loaded result and draft across same-listing sections but reopens unloaded", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    await workspace.setCompanyRoute(route());
    const selected = workspace.getSnapshot().research!.selection;
    workspace.noteResearch(selected, "kept in shared draft");
    await workspace.eod.load();
    const loaded = workspace.eod.getSnapshot();
    await workspace.setCompanyRoute(route(listing.listingId, "annual"));
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().research!.selection).toBe(selected);
    expect(workspace.eod.getSnapshot()).toBe(loaded);
    expect(api.resolve).toHaveBeenCalledOnce();
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    await workspace.setCompanyRoute(null);
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().research!.selection).not.toBe(selected);
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("kept in shared draft");
    workspace.noteResearch(selected, "stale callback");
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("kept in shared draft");
  });
  it("keeps a discovery visit's known CIK and selection when synchronizing its URL", async () => {
    const { workspace, api } = linkedFixture();
    const discovery = { ...result, ...listing, cik: "0000000001" };
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [discovery],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    await ready(workspace);
    workspace.openDiscoveryEod(discovery);
    await workspace.eod.load();
    const selected = workspace.getSnapshot().research!.selection;
    const loaded = workspace.eod.getSnapshot();
    await workspace.setCompanyRoute(route());
    await workspace.setCompanyRoute(route(listing.listingId, "annual"));
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().research!.selection).toBe(selected);
    expect(selected).toMatchObject({ cik: "0000000001", origin: "discover" });
    expect(workspace.eod.getSnapshot()).toBe(loaded);
    expect(api.resolve).not.toHaveBeenCalled();
  });
  it("resolves equal tickers as separate exact listing and share-class identities", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.refreshCatalog();
    await workspace.setCompanyRoute(route());
    await workspace.eod.load();
    await workspace.setCompanyRoute(route(alternate.listingId));
    expect(workspace.getSnapshot().research!.selection.listing).toEqual(
      alternate,
    );
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(api.resolve).toHaveBeenCalledTimes(2);
    expect(api.eodHistory).toHaveBeenCalledOnce();
  });
  it("uses the latest section for a pending singleton resolve without repeating it", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.refreshCatalog();
    const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    vi.mocked(api.resolve).mockReturnValueOnce(held.promise);
    const pending = workspace.setCompanyRoute(route());
    await workspace.setCompanyRoute(route(listing.listingId, "annual"));
    held.resolve({
      snapshotSha256: digest,
      results: [{ listingId: listing.listingId, listing }],
    });
    await pending;
    expect(workspace.getSnapshot().research?.section).toBe("annual");
    expect(api.resolve).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
  });
  it.each(["close", "replacement", "catalog", "retire"] as const)(
    "discards late resolve success and auth/catalog errors after %s",
    async (invalidation) => {
      for (const settlement of ["success", "auth", "catalog"] as const) {
        const { workspace, api } = linkedFixture();
        await workspace.refreshCatalog();
        const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
        vi.mocked(api.resolve).mockReturnValueOnce(held.promise);
        const pending = workspace.setCompanyRoute(route());
        const signal = vi.mocked(api.resolve).mock.calls[0]![1];
        if (invalidation === "close") workspace.closeResearch();
        if (invalidation === "replacement")
          await workspace.setCompanyRoute(route(alternate.listingId));
        if (invalidation === "catalog") {
          vi.mocked(api.status).mockResolvedValueOnce({
            snapshot: { ...snapshot, snapshotSha256: nextDigest },
          });
          await workspace.refreshCatalog();
        }
        if (invalidation === "retire") workspace.coordinator.retire();
        const retained = workspace.getSnapshot();
        expect(signal.aborted).toBe(true);
        if (settlement === "success")
          held.resolve({
            snapshotSha256: digest,
            results: [{ listingId: listing.listingId, listing }],
          });
        else
          held.reject(
            settlement === "auth"
              ? new TrialApiError("unauthenticated")
              : new ManagedCatalogChangedError(),
          );
        await pending;
        expect(workspace.getSnapshot()).toBe(retained);
        expect(workspace.coordinator.getSnapshot().phase).toBe(
          invalidation === "retire" ? "retired" : "idle",
        );
        expect(api.eodHistory).not.toHaveBeenCalled();
        expect(api.annualReport).not.toHaveBeenCalled();
      }
    },
  );
  it("reports unknown identity and retries only through the explicit retry action", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockResolvedValueOnce({
      snapshotSha256: digest,
      results: [{ listingId: listing.listingId, listing: null }],
    });
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.getSnapshot().companyRoute?.status).toBe("unavailable");
    await workspace.setCompanyRoute(route());
    await workspace.refreshCatalog();
    expect(api.resolve).toHaveBeenCalledOnce();
    await workspace.retryCompanyRoute();
    expect(api.resolve).toHaveBeenCalledTimes(2);
    expect(workspace.getSnapshot().companyRoute?.status).toBe("open");
  });
  it.each([
    "digest",
    "row-id",
    "listing-id",
    "extra-row",
    "extra-field",
  ] as const)("rejects a malformed resolved response: %s", async (fault) => {
    const { workspace, api } = linkedFixture();
    await workspace.refreshCatalog();
    const response = {
      snapshotSha256: digest as string,
      results: [{ listingId: listing.listingId, listing: { ...listing } }],
    };
    if (fault === "digest") response.snapshotSha256 = nextDigest;
    if (fault === "row-id")
      response.results[0]!.listingId = alternate.listingId;
    if (fault === "listing-id")
      response.results[0]!.listing.listingId = alternate.listingId;
    if (fault === "extra-row")
      response.results.push({
        listingId: alternate.listingId,
        listing: alternate,
      });
    if (fault === "extra-field")
      Object.assign(response.results[0]!.listing, { cik: "0000000001" });
    vi.mocked(api.resolve).mockResolvedValueOnce(response);
    await workspace.setCompanyRoute(route());
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.getSnapshot().companyRoute?.status).toBe("error");
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
  });
  it.each(["catalog", "auth"] as const)(
    "clears route admission on a current %s refusal",
    async (refusal) => {
      const { workspace, api } = linkedFixture();
      await workspace.refreshCatalog();
      vi.mocked(api.resolve).mockRejectedValueOnce(
        refusal === "catalog"
          ? new ManagedCatalogChangedError()
          : new TrialApiError("unauthenticated"),
      );
      await workspace.setCompanyRoute(route());
      expect(workspace.getSnapshot().companyRoute).toBeNull();
      expect(workspace.getSnapshot().research).toBeNull();
      if (refusal === "catalog") await workspace.refreshCatalog();
      expect(api.resolve).toHaveBeenCalledOnce();
    },
  );
  it("preserves the shared price cooldown across closing and resolving a new visit", async () => {
    const { workspace, api } = linkedFixture();
    await workspace.refreshCatalog();
    await workspace.setCompanyRoute(route());
    vi.mocked(api.eodHistory).mockRejectedValueOnce(
      new ManagedEodCooldownError(new Date(Date.now() + 60_000).toISOString()),
    );
    await workspace.eod.load();
    workspace.closeResearch();
    await workspace.setCompanyRoute(route());
    await workspace.eod.load();
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(workspace.eod.getSnapshot().response).toBeNull();
  });
});

describe("Price comparison appended to the existing shared note", () => {
  const zero: PersonalSecurityMasterSearchResultDto = {
    ...eodSelection.listing,
    cik: "0000000001",
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  };
  async function noteFixture() {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(second), note: "Keep the other class" },
        { ...listingMembership(zero), note: "Original thesis" },
      ],
    });
    const { workspace, api } = setup;
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [zero, second],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    const response = eodResponse();
    vi.mocked(api.eodHistory).mockResolvedValue(response);
    await ready(workspace);
    workspace.openDiscoveryEod(zero);
    await workspace.eod.load();
    return {
      ...setup,
      selection: workspace.getSnapshot().research!.selection,
      response,
      start: response.rows[0]!,
    };
  }

  it("uses latest raw prose, preserves the other note/order and saves and reloads only explicitly", async () => {
    const { workspace, api, session, saved, selection, response, start } =
      await noteFixture();
    expect(workspace.getPriceNoteAction(selection, response, start)).toEqual({
      canAppend: true,
      reason: null,
    });
    const latest = "  Cafe\u0301 thesis updated after rendering  ";
    workspace.note(zero.listingId, latest);
    const before = workspace.coordinator.getSnapshot().draft!;
    const expected =
      latest + " " + priceComparisonNoteExcerpt(response, start, false)!;
    expect(
      workspace.appendPriceComparisonToResearchNote(selection, response, start),
    ).toEqual({
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    });
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships).toEqual([
      before.memberships[0],
      { ...before.memberships[1], note: expected },
    ]);
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    workspace.closeResearch();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships[1]?.note).toBe(
      normalizeWatchlistNote(expected),
    );
    const reopened = new ManagedWorkspace(api, session);
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
    expect(
      saved().payload.memberships.map((member) => member.listingId),
    ).toEqual([second.listingId, zero.listingId]);
  });

  it("supports a Price section first opened from Annual without requiring the two model selections to be the same object", async () => {
    const { workspace, api, response, start } = await noteFixture();
    workspace.openDiscoveryAnnual(zero);
    const selection = workspace.getSnapshot().research!.selection;
    workspace.switchToEod();
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot().selection).not.toBe(selection);
    expect(
      workspace.appendPriceComparisonToResearchNote(selection, response, start)
        .appended,
    ).toBe(true);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each([
    "copied selection",
    "copied response",
    "copied row",
    "latest row",
    "reopened visit",
    "other listing",
    "closed visit",
    "Annual section",
    "equal-valued replacement response",
    "catalog change",
    "retirement",
  ])(
    "rejects a callback after %s without a write or extra read",
    async (boundary) => {
      const setup = await noteFixture();
      const { workspace, api, response } = setup;
      let { selection, start } = setup;
      let capturedResponse = response;
      if (boundary === "copied selection") selection = { ...selection };
      else if (boundary === "copied response")
        capturedResponse = { ...response };
      else if (boundary === "copied row") start = { ...start };
      else if (boundary === "latest row") start = response.rows.at(-1)!;
      else if (boundary === "reopened visit") {
        workspace.closeResearch();
        workspace.openDiscoveryEod(zero);
        await workspace.eod.load();
      } else if (boundary === "other listing")
        workspace.openDiscoveryEod(second);
      else if (boundary === "closed visit") workspace.closeResearch();
      else if (boundary === "Annual section") workspace.switchToAnnual();
      else if (boundary === "equal-valued replacement response") {
        vi.mocked(api.eodHistory).mockResolvedValueOnce(eodResponse());
        await workspace.eod.load();
      } else if (boundary === "catalog change") {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      } else workspace.coordinator.retire();
      const before = workspace.coordinator.getSnapshot().draft;
      const reads = vi.mocked(api.eodHistory).mock.calls.length;
      expect(
        workspace.getPriceNoteAction(selection, capturedResponse, start)
          .canAppend,
      ).toBe(false);
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          capturedResponse,
          start,
        ).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.eodHistory).toHaveBeenCalledTimes(reads);
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("blocks a pending refresh, appends after Cancel and fences late replacement", async () => {
    const { workspace, api, selection, response, start } = await noteFixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
    const loading = workspace.eod.load();
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendPriceComparisonToResearchNote(selection, response, start),
    ).toEqual({
      appended: false,
      message: "Wait for the close history request to finish or cancel it.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.eod.cancel();
    expect(
      workspace.appendPriceComparisonToResearchNote(selection, response, start)
        .appended,
    ).toBe(true);
    const appended = workspace.coordinator.getSnapshot().draft;
    expect(appended?.memberships[1]?.note).toBe(
      "Original thesis " + priceComparisonNoteExcerpt(response, start, true),
    );
    held.resolve(eodResponse());
    await loading;
    expect(workspace.eod.getSnapshot().response).toBe(response);
    expect(workspace.coordinator.getSnapshot().draft).toBe(appended);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each([
    "transient",
    "cooldown",
    "invalid response",
    "catalog",
    "authentication",
  ])("uses the existing %s result-retention boundary", async (boundary) => {
    const { workspace, api, selection, response, start } = await noteFixture();
    const failure =
      boundary === "transient"
        ? new ManagedEodHistoryError("unavailable")
        : boundary === "cooldown"
          ? new ManagedEodCooldownError(
              new Date(Date.now() + 60_000).toISOString(),
            )
          : boundary === "catalog"
            ? new ManagedCatalogChangedError()
            : new TrialApiError(
                boundary === "authentication"
                  ? "unauthenticated"
                  : "invalid_response",
              );
    vi.mocked(api.eodHistory).mockRejectedValueOnce(failure);
    await workspace.eod.load();
    const before = workspace.coordinator.getSnapshot().draft;
    const retained = boundary === "transient" || boundary === "cooldown";
    expect(
      workspace.appendPriceComparisonToResearchNote(selection, response, start)
        .appended,
    ).toBe(retained);
    if (retained) {
      expect(workspace.eod.getSnapshot().response).toBe(response);
      expect(
        workspace.coordinator.getSnapshot().draft?.memberships[1]?.note,
      ).toBe(
        "Original thesis " + priceComparisonNoteExcerpt(response, start, true),
      );
    } else expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["missing member", "changed identity", "stale draft catalog"])(
    "preserves the %s guard without implicit membership changes",
    async (boundary) => {
      const { workspace, api, selection, response, start } =
        await noteFixture();
      const draft = workspace.coordinator.getSnapshot().draft!;
      workspace.coordinator.replaceDraft({
        ...draft,
        snapshotSha256:
          boundary === "stale draft catalog" ? nextDigest : digest,
        memberships:
          boundary === "missing member"
            ? [draft.memberships[0]!]
            : draft.memberships.map((member) =>
                member.listingId === zero.listingId &&
                boundary === "changed identity"
                  ? { ...member, shareClassId: "different-class" }
                  : member,
              ),
      });
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
        ).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "does not bypass a %s watchlist operation",
    async (boundary) => {
      const { workspace, api, selection, response, start } =
        await noteFixture();
      workspace.note(zero.listingId, "Changed thesis");
      const held = deferred<never>();
      let pending: Promise<void> | null = null;
      if (boundary === "loading") {
        vi.mocked(api.load).mockReturnValueOnce(held.promise);
        pending = workspace.coordinator.load();
      } else if (boundary === "saving") {
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
        pending = workspace.coordinator.save();
      } else {
        vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError(boundary));
        await workspace.coordinator.save();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      const saves = vi.mocked(api.save).mock.calls.length;
      expect(
        workspace.getPriceNoteAction(selection, response, start).canAppend,
      ).toBe(false);
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
        ).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).toHaveBeenCalledTimes(saves);
      expect(api.eodHistory).toHaveBeenCalledOnce();
      if (pending) {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
    },
  );

  it.each(["😀", "e\u0301"])(
    "allows exactly 2,000 normalized codepoints with %s and rejects overflow atomically",
    async (unit) => {
      const { workspace, selection, response, start } = await noteFixture();
      const excerpt = priceComparisonNoteExcerpt(response, start, false)!;
      const room = 2000 - [...excerpt].length - 1;
      workspace.note(zero.listingId, unit.repeat(room + 1));
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
        ).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      workspace.note(zero.listingId, unit.repeat(room));
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
        ).appended,
      ).toBe(true);
      const text =
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
      expect(text).toBe(unit.repeat(room) + " " + excerpt);
      expect([...normalizeWatchlistNote(text)!]).toHaveLength(2000);
    },
  );

  it.each(["", "bad\nline", "invisible\u200btext"])(
    "handles the latest note %j without silent rewriting",
    async (note) => {
      const { workspace, api, selection, response, start } =
        await noteFixture();
      workspace.note(zero.listingId, note);
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
        ).appended,
      ).toBe(note === "");
      if (note === "")
        expect(
          workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
        ).toBe(priceComparisonNoteExcerpt(response, start, false));
      else expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );
});

describe("Annual evidence appended to the existing shared note", () => {
  const zero: PersonalSecurityMasterSearchResultDto = {
    ...eodSelection.listing,
    cik: "0000000001",
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  };
  async function noteFixture(note = "Original thesis") {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(second), note: "Keep the other class" },
        { ...listingMembership(zero), note },
      ],
    });
    const { workspace, api } = setup;
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [zero, second],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    const response = await annualResponse();
    vi.mocked(api.annualReport).mockResolvedValue(response);
    await ready(workspace);
    workspace.openDiscoveryAnnual(zero);
    await workspace.annual.load();
    const selection = workspace.getSnapshot().research!.selection;
    const pair = response.evidence.resolution.bases.find(
      (basis) => basis.status === "eligible",
    )!.pairs[0]!;
    return { ...setup, selection, response, pair };
  }

  it("uses the latest raw prose, preserves listing/order and saves only through explicit whole-list save", async () => {
    const { workspace, api, session, saved, selection, response, pair } =
      await noteFixture();
    expect(workspace.getAnnualNoteAction(selection, response, pair)).toEqual({
      canAppend: true,
      reason: null,
    });
    const latest = "  Cafe\u0301 thesis updated after rendering  ";
    workspace.note(zero.listingId, latest);
    const before = workspace.coordinator.getSnapshot().draft!;
    const expected = latest + " " + annualNoteExcerpt(response, pair, false)!;
    expect(
      workspace.appendAnnualToResearchNote(selection, response, pair),
    ).toEqual({
      appended: true,
      message:
        "Annual evidence added to the note draft. Review and save all changes in My Watchlist.",
    });
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships[0]).toStrictEqual(before.memberships[0]);
    expect(draft.memberships[1]).toEqual({
      ...before.memberships[1],
      note: expected,
    });
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    workspace.switchToEod();
    workspace.switchToAnnual();
    workspace.closeResearch();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships[1]?.note).toBe(
      normalizeWatchlistNote(expected),
    );
    const reopened = new ManagedWorkspace(api, session);
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
    expect(
      saved().payload.memberships.map((member) => member.listingId),
    ).toEqual([second.listingId, zero.listingId]);
  });

  it.each([
    "copied selection",
    "copied response",
    "copied pair",
    "reopened visit",
    "other listing",
    "closed visit",
    "Price section",
    "replacement response",
    "catalog change",
    "retirement",
  ])(
    "rejects a callback after %s without altering the draft",
    async (boundary) => {
      const setup = await noteFixture();
      const { workspace, api, response } = setup;
      let { selection, pair } = setup;
      let capturedResponse = response;
      if (boundary === "copied selection") selection = { ...selection };
      else if (boundary === "copied response")
        capturedResponse = { ...response };
      else if (boundary === "copied pair") pair = { ...pair };
      else if (boundary === "reopened visit") {
        workspace.closeResearch();
        workspace.openDiscoveryAnnual(zero);
        await workspace.annual.load();
      } else if (boundary === "other listing")
        workspace.openDiscoveryAnnual(second);
      else if (boundary === "closed visit") workspace.closeResearch();
      else if (boundary === "Price section") workspace.switchToEod();
      else if (boundary === "replacement response") {
        vi.mocked(api.annualReport).mockResolvedValueOnce(
          await annualResponse(),
        );
        await workspace.annual.load();
      } else if (boundary === "catalog change") {
        vi.mocked(api.status).mockResolvedValue({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      } else workspace.coordinator.retire();
      const before = workspace.coordinator.getSnapshot().draft;
      const reads = vi.mocked(api.annualReport).mock.calls.length;
      expect(
        workspace.getAnnualNoteAction(selection, capturedResponse, pair)
          .canAppend,
      ).toBe(false);
      expect(
        workspace.appendAnnualToResearchNote(selection, capturedResponse, pair)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.annualReport).toHaveBeenCalledTimes(reads);
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("blocks a pending refresh, then appends the retained report after Cancel and fences late success", async () => {
    const { workspace, api, selection, response, pair } = await noteFixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
    const loading = workspace.annual.load();
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendAnnualToResearchNote(selection, response, pair),
    ).toEqual({
      appended: false,
      message: "Wait for the Annual report request to finish or cancel it.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.annual.cancel();
    expect(
      workspace.appendAnnualToResearchNote(selection, response, pair).appended,
    ).toBe(true);
    const appended = workspace.coordinator.getSnapshot().draft;
    expect(appended?.memberships[1]?.note).toBe(
      "Original thesis " + annualNoteExcerpt(response, pair, true),
    );
    held.resolve(await annualResponse(undefined, "2026-09-21T00:00:00.000Z"));
    await loading;
    expect(workspace.annual.getSnapshot().response).toBe(response);
    expect(workspace.coordinator.getSnapshot().draft).toBe(appended);
    expect(api.annualReport).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["missing member", "changed identity", "stale draft catalog"])(
    "reuses the existing %s guard and never adds implicitly",
    async (boundary) => {
      const { workspace, api, selection, response, pair } = await noteFixture();
      const draft = workspace.coordinator.getSnapshot().draft!;
      workspace.coordinator.replaceDraft({
        ...draft,
        snapshotSha256:
          boundary === "stale draft catalog" ? nextDigest : digest,
        memberships:
          boundary === "missing member"
            ? [draft.memberships[0]!]
            : draft.memberships.map((member) =>
                member.listingId === zero.listingId &&
                boundary === "changed identity"
                  ? { ...member, shareClassId: "different-class" }
                  : member,
              ),
      });
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendAnnualToResearchNote(selection, response, pair)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
      expect(api.annualReport).toHaveBeenCalledOnce();
    },
  );

  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "does not bypass the %s save coordinator guard",
    async (boundary) => {
      const { workspace, api, selection, response, pair } = await noteFixture();
      workspace.note(zero.listingId, "Changed thesis");
      const held = deferred<never>();
      let pending: Promise<void> | null = null;
      if (boundary === "loading") {
        vi.mocked(api.load).mockReturnValueOnce(held.promise);
        pending = workspace.coordinator.load();
      } else if (boundary === "saving") {
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
        pending = workspace.coordinator.save();
      } else {
        vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError(boundary));
        await workspace.coordinator.save();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      const saves = vi.mocked(api.save).mock.calls.length;
      expect(
        workspace.getAnnualNoteAction(selection, response, pair).canAppend,
      ).toBe(false);
      expect(
        workspace.appendAnnualToResearchNote(selection, response, pair)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).toHaveBeenCalledTimes(saves);
      expect(api.annualReport).toHaveBeenCalledOnce();
      if (pending) {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
    },
  );

  it.each(["emoji", "decomposed"])(
    "accepts exactly 2,000 normalized code points with %s and rejects overflow without truncation",
    async (kind) => {
      const { workspace, selection, response, pair } = await noteFixture();
      const excerpt = annualNoteExcerpt(response, pair, false)!;
      const room = 2000 - [...excerpt].length - 1;
      const unit = kind === "emoji" ? "😀" : "e\u0301";
      workspace.note(zero.listingId, unit.repeat(room + 1));
      const oversized = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendAnnualToResearchNote(selection, response, pair)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(oversized);
      workspace.note(zero.listingId, unit.repeat(room));
      expect(
        workspace.appendAnnualToResearchNote(selection, response, pair)
          .appended,
      ).toBe(true);
      const text =
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
      expect(text).toBe(unit.repeat(room) + " " + excerpt);
      expect([...normalizeWatchlistNote(text)!]).toHaveLength(2000);
    },
  );

  it.each(["private\nline", "invisible\u200btext", "x".repeat(2001)])(
    "rejects an invalid latest note without erasing it",
    async (note) => {
      const { workspace, api, selection, response, pair } = await noteFixture();
      expect(
        workspace.getAnnualNoteAction(selection, response, pair).canAppend,
      ).toBe(true);
      workspace.note(zero.listingId, note);
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendAnnualToResearchNote(selection, response, pair)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );
});
