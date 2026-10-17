import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedEodHistoryResponseDto,
  type ManagedResearchFollowupsDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedEodCooldownError, type ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";
import type { ManagedPriceStudyKey } from "./managed-price-studies";
import type { TrialSession } from "./session";

const digest = eodSelection.catalogSnapshotSha256;
const authored = "Café 東京 📈 thesis";
const chosen = ["windowChange", "drawdown"] as const;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-price-studies-workspace",
  catalogVersion: "invented-v1",
  acquiredAt: "2026-09-19T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
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
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function fixture(loadPrice = true) {
  const response = eodResponse();
  const member = { ...eodSelection.listing, note: authored };
  const other = {
    ...member,
    listingId: "listing-other",
    securityId: "security-other",
    shareClassId: "class-other",
    symbol: "OTHER",
    note: "Independent other share class",
  };
  let stored: { version: number; payload: MainWatchlistPayload } = {
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [other, member],
    },
  };
  const followups: ManagedResearchFollowupsDto = {
    version: 1,
    payload: {
      schemaVersion: 1,
      entries: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          catalogSnapshotSha256: digest,
          listing: { ...eodSelection.listing },
          check: "Review next filing",
          dueOn: "2026-10-20",
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    },
  };
  const unexpected = () =>
    Promise.reject(new Error("Unexpected unrelated request"));
  const receipts = new Map<
    string,
    { command: Parameters<ManagedApi["save"]>[0]; stored: typeof stored }
  >();
  const save = vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
    const receipt = receipts.get(command.idempotencyKey);
    if (receipt) {
      if (JSON.stringify(receipt.command) !== JSON.stringify(command))
        throw new TrialApiError("idempotency_conflict");
      return Promise.resolve({
        ...structuredClone(receipt.stored),
        replayed: true,
      });
    }
    if (command.expectedVersion !== stored.version)
      return Promise.reject(new TrialApiError("conflict"));
    stored = {
      version: stored.version + 1,
      payload: structuredClone(command.payload),
    };
    receipts.set(command.idempotencyKey, {
      command: structuredClone(command),
      stored: structuredClone(stored),
    });
    return Promise.resolve({ ...structuredClone(stored), replayed: false });
  });
  const api: ManagedApi = {
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockImplementation(unexpected),
    savePortfolio: vi
      .fn<ManagedApi["savePortfolio"]>()
      .mockImplementation(unexpected),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockImplementation(unexpected),
    eodHistory: vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue(response),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockImplementation(unexpected),
    economicCalendar: vi
      .fn<ManagedApi["economicCalendar"]>()
      .mockImplementation(unexpected),
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockImplementation(unexpected),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation(unexpected),
    search: vi.fn<ManagedApi["search"]>().mockImplementation(unexpected),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    save,
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(followups))),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation(unexpected),
  };
  const session: TrialSession = {
    userId: "invented-price-studies-user",
    sessionId: "invented-price-studies-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    priceCoverage: [eodSelection.listing],
  });
  owners.push(workspace);
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.followups.coordinator.load();
  workspace.followups.edit(
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!,
    "check",
    "Independent unsaved follow-up",
  );
  const open = () =>
    workspace.openWatchlistEod(
      workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find(
          (entry) => entry.listingId === member.listingId,
        )!,
    );
  open();
  const load = () =>
    workspace.requestResearchSource(workspace.getSnapshot().research!, "eod");
  if (loadPrice) await load();
  const selection = () => workspace.getSnapshot().research!.selection;
  const currentResponse = () => workspace.eod.getSnapshot().response!;
  const note = () =>
    workspace.coordinator
      .getSnapshot()
      .draft?.memberships.find((entry) => entry.listingId === member.listingId)
      ?.note;
  const prepare = (
    keys: readonly ManagedPriceStudyKey[] = chosen,
    guard = () => true,
  ) =>
    workspace.preparePriceStudiesNote(
      selection(),
      currentResponse(),
      keys,
      guard,
    );
  const preview = (
    keys: readonly ManagedPriceStudyKey[] = chosen,
    guard = () => true,
  ) => {
    const result = prepare(keys, guard);
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  const noOtherRequests = () => {
    for (const fn of [
      api.annualReport,
      api.recentFilings,
      api.economicCalendar,
      api.monetaryAnnouncements,
      api.resolve,
      api.search,
      api.saveFollowups,
      api.loadPortfolio,
      api.savePortfolio,
    ])
      expect(fn).not.toHaveBeenCalled();
    expect(api.loadFollowups).toHaveBeenCalledOnce();
    expect(api.status).toHaveBeenCalledOnce();
  };
  return {
    workspace,
    api,
    session,
    response,
    member,
    other,
    open,
    load,
    selection,
    currentResponse,
    note,
    prepare,
    preview,
    noOtherRequests,
    stored: () => structuredClone(stored),
    setStored: (next: typeof stored) => {
      stored = structuredClone(next);
    },
  };
}

describe("raw price studies through the real workspace draft and Save", () => {
  it("explicitly loads history, previews the whole note, appends once, reviews, saves and freshly reads the exact note", async () => {
    const f = await fixture(false);
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.prepare().preview).toBeNull();
    await f.load();
    expect(f.api.eodHistory).toHaveBeenCalledExactlyOnceWith(
      eodRequest(),
      expect.any(AbortSignal),
    );
    expect(f.currentResponse()).toBe(f.response);
    const otherDraft = { ...f.other, note: "Independent unsaved other note" };
    f.workspace.note(f.other.listingId, otherDraft.note);
    const originalDraft = f.workspace.coordinator.getSnapshot().draft;
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const preview = f.preview();
    expect(preview.keys).toEqual(chosen);
    expect(preview.note.startsWith(`${authored} `)).toBe(true);
    expect(preview.note).toContain("Loaded-window raw close change: 1.2469%");
    expect(preview.note).toContain("Maximum observed drawdown: 0.0000%");
    expect(preview.note).toContain("2026-09-18 through 2026-09-19");
    expect(preview.note).toContain("requested 2026-09-20T00:00:00.000Z");
    expect(preview.note).toContain("completed 2026-09-20T00:00:01.000Z");
    expect(preview.note).toContain("unadjusted for splits/dividends");
    expect(preview.note).toContain("observed gaps are not filled");
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(originalDraft);
    expect(f.workspace.priceStudiesNoteIsCurrent(preview)).toBe(true);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(true);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.note()).toBe(preview.note);
    expect(f.api.save).not.toHaveBeenCalled();
    const review = renderToStaticMarkup(
      createElement(ManagedUnsavedWatchlistReview, {
        state: f.workspace.coordinator.getSnapshot(),
      }),
    );
    expect(review).toContain("Review unsaved changes");
    expect(review).toContain("2 changed listings");
    expect(review).toContain(otherDraft.note);
    expect(review).toContain(preview.note);
    expect(f.workspace.canSavePayload()).toBe(true);
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(vi.mocked(f.api.save).mock.calls[0]![0].payload).toEqual(
      f.stored().payload,
    );
    expect(f.workspace.coordinator.getSnapshot().dirty).toBe(false);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    const fresh = new ManagedWorkspace(f.api, {
      ...f.session,
      sessionId: "invented-fresh-price-session",
    });
    owners.push(fresh);
    await fresh.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft!.memberships).toEqual([
      otherDraft,
      { ...f.member, note: preview.note },
    ]);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    f.noOtherRequests();
  });

  it("owns selected keys and refuses forged, foreign-workspace, copied-source and wrong-section capabilities", async () => {
    const f = await fixture();
    const foreign = await fixture();
    const keys: ManagedPriceStudyKey[] = ["windowChange"];
    const preview = f.preview(keys);
    keys[0] = "drawdown";
    expect(preview.keys).toEqual(["windowChange"]);
    expect(Object.isFrozen(preview.keys)).toBe(true);
    expect(f.workspace.appendPriceStudiesNote({ ...preview }).appended).toBe(
      false,
    );
    expect(foreign.workspace.appendPriceStudiesNote(preview).appended).toBe(
      false,
    );
    expect(
      f.workspace.preparePriceStudiesNote(
        { ...f.selection() },
        f.currentResponse(),
        chosen,
        () => true,
      ).preview,
    ).toBeNull();
    expect(
      f.workspace.preparePriceStudiesNote(
        f.selection(),
        structuredClone(f.currentResponse()),
        chosen,
        () => true,
      ).preview,
    ).toBeNull();
    expect(f.workspace.priceStudiesNoteIsCurrent(preview)).toBe(true);
    f.workspace.switchToAnnual();
    expect(f.prepare().preview).toBeNull();
    f.workspace.switchToEod();
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.note()).toBe(authored);
    expect(foreign.note()).toBe(authored);
    f.noOtherRequests();
  });

  it("does not revive a preview after the note is edited and restored without an intermediate currentness call", async () => {
    const f = await fixture();
    const preview = f.preview();
    f.workspace.noteResearch(f.selection(), "Changed authored note");
    f.workspace.noteResearch(f.selection(), authored);
    const restored = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.priceStudiesNoteIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(restored);
    expect(f.preview().note).toBe(preview.note);
  });

  it("combines the committed choice revision with workspace guards and rechecks a mutating guard", async () => {
    const f = await fixture();
    const initial = Symbol();
    let revision = initial;
    const preview = f.preview(chosen, () => revision === initial);
    revision = Symbol();
    expect([...chosen]).toEqual(preview.keys);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.prepare(chosen, () => false).preview).toBeNull();
    expect(
      f.prepare(chosen, () => {
        throw new Error("Retired choice owner");
      }).preview,
    ).toBeNull();
    let editDuringGuard = false;
    const guarded = f.preview(chosen, () => {
      if (editDuringGuard)
        f.workspace.noteResearch(f.selection(), "New authored note");
      return true;
    });
    editDuringGuard = true;
    expect(f.workspace.appendPriceStudiesNote(guarded).appended).toBe(false);
    expect(f.note()).toBe("New authored note");
    editDuringGuard = false;
    expect(f.workspace.appendPriceStudiesNote(guarded).appended).toBe(false);
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("invalidates the old source capture on range change and restore without requesting or relabeling retained history", async () => {
    const f = await fixture();
    const preview = f.preview();
    const source = f.currentResponse();
    f.workspace.eod.selectRange("1y");
    const heldRange = f.preview(["windowChange"]);
    expect(heldRange.note).toContain(
      "Loaded 1m window 2026-08-20 through 2026-09-20",
    );
    expect(heldRange.note).not.toContain("Loaded 1y");
    f.workspace.eod.selectRange("1m");
    expect(f.currentResponse()).toBe(source);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.workspace.appendPriceStudiesNote(heldRange).appended).toBe(false);
    expect(f.preview().note).toBe(preview.note);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    f.noOtherRequests();
  });

  it.each(["failure", "cancel"] as const)(
    "fences previews at refresh start and preserves original clocks after %s, including late completion",
    async (outcome) => {
      const f = await fixture();
      const preview = f.preview();
      const source = f.currentResponse();
      f.workspace.eod.selectRange("1y");
      const held = deferred<ManagedEodHistoryResponseDto>();
      vi.mocked(f.api.eodHistory).mockReturnValueOnce(held.promise);
      const pending = f.load();
      expect(f.workspace.eod.getSnapshot().running).toBe(true);
      expect(f.prepare().preview).toBeNull();
      expect(vi.mocked(f.api.eodHistory).mock.calls[1]![0]).toEqual(
        eodRequest("1y"),
      );
      if (outcome === "failure") {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      } else {
        f.workspace.cancelResearchSource(
          f.workspace.getSnapshot().research!,
          "eod",
        );
        expect(vi.mocked(f.api.eodHistory).mock.calls[1]![1].aborted).toBe(
          true,
        );
      }
      expect(f.workspace.eod.getSnapshot()).toMatchObject({
        response: source,
        showingPrevious: true,
        running: false,
        selectedRange: "1y",
      });
      expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
      const retained = f.preview();
      expect(retained.note).toContain(
        "Retained previous history; the latest attempt has not confirmed it.",
      );
      expect(retained.note).toContain("Loaded 1m window");
      expect(retained.note).toContain(source.completedAt);
      expect(f.workspace.appendPriceStudiesNote(retained).appended).toBe(true);
      const appended = f.workspace.coordinator.getSnapshot().draft;
      if (outcome === "cancel") {
        held.resolve(eodResponse("1y"));
        await pending;
      }
      expect(f.currentResponse()).toBe(source);
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(appended);
      expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
      f.noOtherRequests();
    },
  );

  it.each([
    "visit round trip",
    "navigation round trip",
    "catalog change",
    "member removal",
  ] as const)("refuses Append after %s", async (boundary) => {
    const f = await fixture();
    const preview = f.preview();
    if (boundary === "visit round trip") {
      f.workspace.closeResearch();
      f.open();
    }
    if (boundary === "navigation round trip") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "catalog change") {
      vi.mocked(f.api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: `sha256:${"d".repeat(64)}` },
      });
      await f.workspace.refreshCatalog();
    }
    if (boundary === "member removal") f.workspace.remove(f.member.listingId);
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.priceStudiesNoteIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("keeps the appended note through conflict, explicit latest review, keep draft and resave", async () => {
    const f = await fixture();
    const preview = f.preview();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(true);
    const appended = f.workspace.coordinator.getSnapshot().draft;
    vi.mocked(f.api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      conflict: true,
      latestLoaded: false,
    });
    expect(f.prepare().preview).toBeNull();
    f.setStored({
      version: 2,
      payload: {
        ...f.stored().payload,
        memberships: [f.other, { ...f.member, note: "Peer saved note" }],
      },
    });
    await f.workspace.coordinator.load();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      conflict: true,
      latestLoaded: true,
      draft: appended,
    });
    const latest = f.workspace.coordinator.getSnapshot();
    const review = renderToStaticMarkup(
      createElement(ManagedWatchlistReview, {
        saved: latest.saved!.payload,
        draft: latest.draft!,
        version: latest.saved!.version,
      }),
    );
    expect(review).toContain("Review saved version 2 and my draft");
    expect(review).toContain("Peer saved note");
    expect(review).toContain(preview.note);
    f.workspace.coordinator.keepDraft();
    await f.workspace.coordinator.save();
    expect(vi.mocked(f.api.save).mock.calls[1]![0].expectedVersion).toBe(2);
    expect(f.stored()).toMatchObject({
      version: 3,
      payload: { memberships: [f.other, { ...f.member, note: preview.note }] },
    });
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    f.noOtherRequests();
  });

  it("reconciles exactly the original uncertain Save and explicitly adopts its reviewed saved result", async () => {
    const f = await fixture();
    const preview = f.preview();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(true);
    const commit = vi.mocked(f.api.save).getMockImplementation()!;
    vi.mocked(f.api.save).mockImplementationOnce(async (command, signal) => {
      await commit(command, signal);
      throw new TrialApiError("commit_unknown");
    });
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.prepare().preview).toBeNull();
    await f.workspace.coordinator.reconcile();
    expect(vi.mocked(f.api.save).mock.calls[1]![0]).toEqual(
      vi.mocked(f.api.save).mock.calls[0]![0],
    );
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: false,
      replayPending: true,
    });
    expect(f.stored().version).toBe(2);
    expect(f.note()).toBe(preview.note);
    await f.workspace.coordinator.load();
    f.workspace.coordinator.useSaved();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      dirty: false,
      conflict: false,
      replayPending: false,
    });
    expect(f.note()).toBe(preview.note);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.api.save).toHaveBeenCalledTimes(2);
    f.noOtherRequests();
  });

  it("refuses a held preview while Save is pending and after an uncertain completion", async () => {
    const f = await fixture();
    f.workspace.noteResearch(f.selection(), "Unsaved prior edit");
    const preview = f.preview();
    const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
    vi.mocked(f.api.save).mockReturnValueOnce(held.promise);
    const pending = f.workspace.coordinator.save();
    expect(f.prepare().preview).toBeNull();
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    held.reject(new TrialApiError("commit_unknown"));
    await pending;
    expect(f.note()).toBe("Unsaved prior edit");
    expect(f.workspace.priceStudiesNoteIsCurrent(preview)).toBe(false);
  });

  it("clears session-owned drafts and ignores a late EOD result after retirement", async () => {
    const f = await fixture();
    const preview = f.preview();
    const stored = f.stored();
    const held = deferred<ManagedEodHistoryResponseDto>();
    vi.mocked(f.api.eodHistory).mockReturnValueOnce(held.promise);
    const pending = f.load();
    f.workspace.coordinator.retire();
    expect(vi.mocked(f.api.eodHistory).mock.calls[1]![1].aborted).toBe(true);
    held.resolve(eodResponse());
    await pending;
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.stored()).toEqual(stored);
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("refuses an unavailable selected study as a whole and enforces the exact normalized note boundary", async () => {
    const f = await fixture();
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.prepare(["windowChange", "sma200"]).preview).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    f.workspace.noteResearch(f.selection(), "");
    const excerpt = f.preview(["windowChange"]);
    const room = 2000 - [...normalizeWatchlistNote(excerpt.note)!].length - 1;
    expect(room).toBeGreaterThan(0);
    f.workspace.noteResearch(f.selection(), "😀".repeat(room + 1));
    const overlong = f.note();
    expect(f.prepare(["windowChange"]).preview).toBeNull();
    expect(f.note()).toBe(overlong);
    f.workspace.noteResearch(f.selection(), "😀".repeat(room));
    const exact = f.preview(["windowChange"]);
    expect([...normalizeWatchlistNote(exact.note)!]).toHaveLength(2000);
    expect(f.workspace.appendPriceStudiesNote(exact).appended).toBe(true);
    expect(f.note()).toBe(exact.note);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
  });

  it("honors an actual checked EOD cooldown without extra requests and labels the retained source", async () => {
    const f = await fixture();
    const preview = f.preview();
    const nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(f.api.eodHistory).mockRejectedValueOnce(
      new ManagedEodCooldownError(nextAllowedAt),
    );
    await f.load();
    await f.load();
    expect(f.api.eodHistory).toHaveBeenCalledTimes(2);
    expect(f.workspace.eod.getSnapshot()).toMatchObject({
      response: f.response,
      showingPrevious: true,
      running: false,
    });
    expect(f.workspace.eod.getSnapshot().message).toContain(nextAllowedAt);
    expect(f.workspace.appendPriceStudiesNote(preview).appended).toBe(false);
    const retained = f.preview(["windowChange"]);
    expect(retained.note).toContain("Retained previous history");
    expect(f.workspace.appendPriceStudiesNote(retained).appended).toBe(true);
    f.noOtherRequests();
  });
});
