import { describe, expect, it, vi } from "vitest";
import {
  normalizeWatchlistNote,
  parseManagedEconomicCalendar,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type PersonalSecurityMasterSearchResultDto,
  type PersonalEconomicCalendarDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { listingMembership, ManagedWorkspace } from "./managed-workspace";
import type { TrialSession } from "./session";
import { eodSelection } from "./eod-history-fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import {
  getBeaReleaseNoteEvidence,
  type BeaReleaseNoteCapture,
} from "./managed-bea-release-note";

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
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockRejectedValue(
        new Error("Follow-ups require an explicit fixture action"),
      ),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockRejectedValue(
        new Error("Follow-ups require an explicit fixture action"),
      ),
    monetaryAnnouncements: vi.fn<ManagedApi["monetaryAnnouncements"]>(),
    economicCalendar: vi
      .fn<ManagedApi["economicCalendar"]>()
      .mockRejectedValue(new Error("Unexpected agenda read")),
    eodHistory: vi.fn(),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>(),
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
    {
      priceCoverage: [
        eodSelection.listing,
        listingMembership(result),
        listingMembership(second),
      ],
    },
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

describe("BEA release appended to one current draft note", () => {
  async function noteFixture(raw = economicCalendarFixture()) {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(result), note: "First thesis" },
        { ...listingMembership(second), note: "Other share class thesis" },
      ],
    });
    await ready(setup.workspace);
    const response = parseManagedEconomicCalendar(raw)!;
    expect(response).not.toBeNull();
    vi.mocked(setup.api.economicCalendar).mockResolvedValue(response);
    setup.workspace.setView("markets");
    await setup.workspace.agenda.load();
    const capture = (): BeaReleaseNoteCapture => {
      const state = setup.workspace.agenda.getSnapshot();
      return {
        response: state.agenda!,
        event: state.agenda!.events[0]!,
        showingPrevious: state.showingPrevious,
      };
    };
    const member = (listingId = result.listingId) =>
      setup.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find((entry) => entry.listingId === listingId)!;
    const counts = () =>
      [
        setup.api.economicCalendar,
        setup.api.monetaryAnnouncements,
        setup.api.eodHistory,
        setup.api.annualReport,
        setup.api.recentFilings,
        setup.api.resolve,
        setup.api.save,
        setup.session.getToken,
        setup.session.signOut,
      ].map((call) => vi.mocked(call).mock.calls.length);
    return { ...setup, response, capture, member, counts };
  }

  it.each([result.listingId, second.listingId])(
    "appends to the latest %s note and explicitly saves the complete reordered draft",
    async (listingId) => {
      const { workspace, api, session, saved, capture, member, counts } =
        await noteFixture();
      const selected = capture();
      const staleMember = member(listingId);
      const raw = "  Cafe\u0301 updated 😀  ";
      workspace.note(listingId, raw);
      workspace.move(second.listingId, -1);
      const before = workspace.coordinator.getSnapshot().draft!;
      expect(
        workspace.appendBeaReleaseToNote(selected, staleMember).appended,
      ).toBe(false);
      const originalCounts = counts();
      const excerpt = getBeaReleaseNoteEvidence(selected).excerpt!;
      expect(
        workspace.getBeaReleaseNoteAction(selected, member(listingId)),
      ).toEqual({ canAppend: true, reason: null });
      expect(
        workspace.appendBeaReleaseToNote(selected, member(listingId)).appended,
      ).toBe(true);
      expect(workspace.coordinator.getSnapshot().draft).toEqual({
        ...before,
        memberships: before.memberships.map((entry) =>
          entry.listingId === listingId
            ? { ...entry, note: raw + " " + excerpt }
            : entry,
        ),
      });
      expect(counts()).toEqual(originalCounts);
      expect(api.save).not.toHaveBeenCalled();
      await workspace.coordinator.save();
      expect(api.save).toHaveBeenCalledOnce();
      expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(
        saved().payload,
      );
      expect(
        saved().payload.memberships.find(
          (entry) => entry.listingId === listingId,
        )!.note,
      ).toBe(normalizeWatchlistNote(raw + " " + excerpt));
      const reopened = new ManagedWorkspace(api, session);
      await reopened.coordinator.load();
      expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
      expect(
        saved().payload.memberships.map((entry) => entry.listingId),
      ).toEqual([second.listingId, result.listingId]);
    },
  );

  it("accepts an explicitly added unsaved member without reading or saving", async () => {
    const { workspace, api, capture, member } = await noteFixture();
    workspace.remove(second.listingId);
    workspace.add(second);
    const before = workspace.coordinator.getSnapshot().draft!;
    expect(
      workspace.appendBeaReleaseToNote(capture(), member(second.listingId))
        .appended,
    ).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft!.memberships[0]).toEqual(
      before.memberships[0],
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(api.economicCalendar).toHaveBeenCalledOnce();
  });

  it("refuses a canonically identical duplicate after Save and allows a different original retrieval", async () => {
    const raw = economicCalendarFixture();
    const { workspace, api, capture, member } = await noteFixture({
      ...raw,
      events: [
        { ...raw.events[0]!, series: "Cafe\u0301 policy" },
        raw.events[1]!,
      ],
    });
    const original = capture();
    const excerpt = getBeaReleaseNoteEvidence(original).excerpt!;
    expect(excerpt).toContain("Cafe\u0301 policy");
    expect(workspace.appendBeaReleaseToNote(original, member()).appended).toBe(
      true,
    );
    const duplicate =
      "This exact release reference is already in the note draft.";
    expect(workspace.appendBeaReleaseToNote(original, member())).toEqual({
      appended: false,
      message: duplicate,
    });
    await workspace.coordinator.save();
    await workspace.coordinator.load();
    expect(member().note).toContain("Café policy");
    const before = workspace.coordinator.getSnapshot().draft;
    expect(workspace.getBeaReleaseNoteAction(original, member())).toEqual({
      canAppend: false,
      reason: duplicate,
    });
    expect(workspace.appendBeaReleaseToNote(original, member()).appended).toBe(
      false,
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    const replacement = parseManagedEconomicCalendar({
      ...original.response,
      fetchedAt: "2026-10-21T18:00:00.000Z",
      window: {
        fromInclusive: "2026-10-21T18:00:00.000Z",
        toExclusive: "2026-11-20T18:00:00.000Z",
      },
    })!;
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(replacement);
    await workspace.agenda.load();
    expect(workspace.appendBeaReleaseToNote(capture(), member()).appended).toBe(
      true,
    );
    expect(member().note).toContain("2026-10-20T18:00:00.000Z");
    expect(member().note).toContain("2026-10-21T18:00:00.000Z");
    expect(api.save).toHaveBeenCalledOnce();
  });

  it.each(["exact", "overflow", "control", "format"] as const)(
    "checks the complete latest raw note at %s without truncating it",
    async (boundary) => {
      const { workspace, capture, member } = await noteFixture();
      const selected = capture();
      const excerpt = getBeaReleaseNoteEvidence(selected).excerpt!;
      const remaining = 2000 - [...excerpt.normalize("NFC")].length - 1;
      const raw =
        boundary === "control"
          ? "Private\ntext"
          : boundary === "format"
            ? "Private\u200btext"
            : "😀".repeat(remaining + (boundary === "overflow" ? 1 : 0));
      workspace.note(result.listingId, raw);
      const before = workspace.coordinator.getSnapshot().draft;
      const accepted = boundary === "exact";
      expect(
        workspace.getBeaReleaseNoteAction(selected, member()).canAppend,
      ).toBe(accepted);
      expect(
        workspace.appendBeaReleaseToNote(selected, member()).appended,
      ).toBe(accepted);
      if (accepted) {
        expect(member().note).toBe(raw + " " + excerpt);
        expect([...normalizeWatchlistNote(member().note)!]).toHaveLength(2000);
      } else expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    },
  );

  it.each([
    "none",
    "copied",
    "removed",
    "removed and re-added",
    "changed identity",
  ] as const)(
    "refuses a %s destination without editing another member",
    async (kind) => {
      const { workspace, capture, member, counts } = await noteFixture();
      let destination: WatchlistMembership | null = member();
      if (kind === "none") destination = null;
      if (kind === "copied") destination = { ...destination! };
      if (kind === "removed" || kind === "removed and re-added")
        workspace.remove(result.listingId);
      if (kind === "removed and re-added") workspace.add(result);
      if (kind === "changed identity") {
        const draft = workspace.coordinator.getSnapshot().draft!;
        workspace.coordinator.replaceDraft({
          ...draft,
          memberships: draft.memberships.map((entry) =>
            entry.listingId === result.listingId
              ? { ...entry, shareClassName: "Replacement class" }
              : entry,
          ),
        });
      }
      const before = workspace.coordinator.getSnapshot().draft;
      const originalCounts = counts();
      expect(workspace.appendBeaReleaseToNote(capture(), destination)).toEqual({
        appended: false,
        message: "Choose a current watchlist note.",
      });
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(counts()).toEqual(originalCounts);
    },
  );

  it.each([
    "missing",
    "copied item",
    "copied response",
    "equal replacement",
    "empty replacement",
  ] as const)(
    "refuses %s evidence without changing the draft",
    async (kind) => {
      const { workspace, api, capture, member } = await noteFixture();
      const original = capture();
      let selected: BeaReleaseNoteCapture | null = original;
      if (kind === "missing") selected = null;
      if (kind === "copied item")
        selected = { ...original, event: { ...original.event } };
      if (kind === "copied response")
        selected = { ...original, response: { ...original.response } };
      if (kind === "equal replacement" || kind === "empty replacement") {
        const replacement = parseManagedEconomicCalendar(
          kind === "equal replacement"
            ? original.response
            : { ...original.response, events: [] },
        )!;
        vi.mocked(api.economicCalendar).mockResolvedValueOnce(replacement);
        await workspace.agenda.load();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendBeaReleaseToNote(selected, member()).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("refuses an append triggered synchronously by the busy publication", async () => {
    const { workspace, api, capture, member } = await noteFixture();
    const original = capture();
    const destination = member();
    const held = deferred<PersonalEconomicCalendarDto>();
    vi.mocked(api.economicCalendar).mockReturnValueOnce(held.promise);
    const attempted: boolean[] = [];
    const unsubscribe = workspace.agenda.subscribe(() => {
      if (workspace.agenda.getSnapshot().busy)
        attempted.push(
          workspace.appendBeaReleaseToNote(original, destination).appended,
        );
    });
    const before = workspace.coordinator.getSnapshot().draft;
    const pending = workspace.agenda.load();
    expect(attempted).toEqual([false]);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.agenda.cancel();
    held.resolve(original.response);
    await pending;
    unsubscribe();
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["unavailable", "invalid_response"] as const)(
    "appends the retained exact packet after %s only with its current qualifier",
    async (code) => {
      const { workspace, api, capture, member, response } = await noteFixture();
      const original = capture();
      vi.mocked(api.economicCalendar).mockRejectedValueOnce(
        new TrialApiError(code),
      );
      await workspace.agenda.load();
      expect(workspace.agenda.getSnapshot().agenda).toBe(response);
      expect(
        workspace.appendBeaReleaseToNote(original, member()).appended,
      ).toBe(false);
      expect(
        workspace.appendBeaReleaseToNote(capture(), member()).appended,
      ).toBe(true);
      expect(member().note).toContain(
        "Retained previous agenda; a newer schedule was not confirmed.",
      );
      expect(member().note).toContain(response.fetchedAt);
    },
  );

  it.each(["success", "authentication error"] as const)(
    "blocks a held request, permits Cancel, and ignores its late %s after append",
    async (late) => {
      const { workspace, api, capture, member, response } = await noteFixture();
      const held = deferred<PersonalEconomicCalendarDto>();
      vi.mocked(api.economicCalendar).mockReturnValueOnce(held.promise);
      const pending = workspace.agenda.load();
      expect(workspace.appendBeaReleaseToNote(capture(), member())).toEqual({
        appended: false,
        message: "Wait for the agenda request to finish or cancel it.",
      });
      workspace.agenda.cancel();
      expect(vi.mocked(api.economicCalendar).mock.calls[1]![0].aborted).toBe(
        true,
      );
      expect(
        workspace.appendBeaReleaseToNote(capture(), member()).appended,
      ).toBe(true);
      const after = workspace.coordinator.getSnapshot().draft;
      if (late === "success")
        held.resolve(
          parseManagedEconomicCalendar({
            ...response,
            events: [],
          })!,
        );
      else held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.coordinator.getSnapshot().draft).toBe(after);
      expect(workspace.agenda.getSnapshot().agenda).toBe(response);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "watchlist",
    "company",
    "pending route",
    "catalog",
    "retired",
    "authentication",
  ] as const)(
    "refuses a captured action after %s changes the active context",
    async (boundary) => {
      const { workspace, api, capture, member } = await noteFixture();
      const selected = capture();
      const destination = member();
      if (boundary === "watchlist") workspace.setView("watchlist");
      if (boundary === "company") workspace.openDiscoveryAnnual(result);
      if (boundary === "pending route") workspace.setNavigationBlocked(true);
      if (boundary === "catalog") {
        vi.mocked(api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      }
      if (boundary === "retired") workspace.coordinator.retire();
      if (boundary === "authentication") {
        vi.mocked(api.economicCalendar).mockRejectedValueOnce(
          new TrialApiError("unauthenticated"),
        );
        await workspace.agenda.load();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendBeaReleaseToNote(selected, destination).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["conflict", "unavailable"] as const)(
    "refuses while a Save is pending or %s until normal recovery settles",
    async (code) => {
      const { workspace, api, capture, member } = await noteFixture();
      const selected = capture();
      workspace.note(result.listingId, "Latest thesis");
      const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
      vi.mocked(api.save).mockReturnValueOnce(held.promise);
      const pending = workspace.coordinator.save();
      expect(
        workspace.appendBeaReleaseToNote(selected, member()).appended,
      ).toBe(false);
      held.reject(new TrialApiError(code));
      await pending;
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendBeaReleaseToNote(selected, member()).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      if (code === "conflict") {
        await workspace.coordinator.load();
        workspace.coordinator.keepDraft();
      } else await workspace.coordinator.reconcile();
      expect(
        workspace.appendBeaReleaseToNote(selected, member()).appended,
      ).toBe(true);
    },
  );
});
