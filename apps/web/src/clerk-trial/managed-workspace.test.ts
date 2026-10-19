import {
  createManagedResearchCoverageFixture,
  inventedManagedResearchCoverage,
} from "./test-managed-research-coverage-fixture";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import { viewOf } from "../features/research/test-canonical-annual-ui-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import {
  emptyThesisReview,
  proposeThesisReview,
} from "./managed-thesis-review";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedResearchFollowupsDto,
  ResearchFollowup,
  ResearchFollowupsPayload,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedSecCooldownError,
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  listingMembership,
  ManagedWorkspace,
  reviewChanges,
  type ManagedResearchVisit,
} from "./managed-workspace";
import type { TrialSession } from "./session";
import {
  annualComparativeRows,
  annualHistoryRows,
  response as annualResponse,
} from "../features/research/test-canonical-annual-ui-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { annualNoteExcerpt } from "./managed-annual-note";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";
import {
  cashResponse,
  cashRow,
} from "../features/research/test-canonical-annual-cash-ui-fixture";
import { priceComparisonNoteExcerpt } from "./managed-price-note";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import {
  changeManagedWatchlistComparisonInterval,
  createManagedWatchlistComparisonSelection,
  projectManagedWatchlistComparison,
  reconcileManagedWatchlistComparison,
  selectManagedWatchlistComparisonRow,
} from "./managed-watchlist-comparison";
import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import {
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementsDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import {
  getFedAnnouncementNoteEvidence,
  type FedAnnouncementNoteCapture,
} from "./managed-fed-announcement-note";
import {
  annualComparisonMemberships,
  annualComparisonOperatingRows,
  annualComparisonResponse,
  annualComparisonRows,
} from "./test-canonical-annual-comparison-fixture";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import type { ManagedAnnualComparisonReportCapture } from "./managed-watchlist-annual-comparison";
import {
  getAnnualComparisonNoteEvidence,
  type AnnualComparisonNoteCapture,
  type AnnualComparisonNoteGroup,
} from "./managed-watchlist-annual-comparison-note";

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
const workspaceResearchCoverage = createManagedResearchCoverageFixture([
  { listing: eodSelection.listing, cik: "0000000001" },
  { listing: listingMembership(result), cik: "0000000001" },
  { listing: listingMembership(second), cik: "0000000001" },
]);
function workspaceFixtureOptions(researchCoverage: ManagedResearchCoverage) {
  return {
    researchCoverage,
    priceCoverage: [
      eodSelection.listing,
      listingMembership(result),
      listingMembership(second),
    ],
  };
}
function createFixtureWorkspace(
  api: ManagedApi,
  session: TrialSession,
  initial: MainWatchlistPayload,
) {
  let keys = 0;
  const researchCoverage = initial.memberships.some(
    (member) => member.symbol === "ONE" && member.issuerName === "One Company",
  )
    ? inventedManagedResearchCoverage
    : workspaceResearchCoverage;
  const workspace = new ManagedWorkspace(
    api,
    session,
    () => `synthetic-command-${++keys}`,
    workspaceFixtureOptions(researchCoverage),
  );
  workspace.setView("discover");
  return workspace;
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
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockRejectedValue(new Error("Unexpected announcements read")),
    economicCalendar: vi.fn(),
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
  const workspace = createFixtureWorkspace(api, session, initial);
  return { workspace, api, session, saved: () => structuredClone(stored) };
}
async function ready(workspace: ManagedWorkspace) {
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setQuery("Invented");
  await workspace.search();
}

describe("thesis review through the shared watchlist draft", () => {
  it("protects intervening edits, saves the complete draft and reloads the review", async () => {
    const initial = {
      ...empty,
      memberships: [
        { ...listingMembership(result), note: "Original thesis" },
        { ...listingMembership(second), note: "Other share class" },
      ],
    };
    const { workspace, api } = fixture(initial);
    await ready(workspace);
    const review = {
      ...emptyThesisReview,
      purpose: "holding_review" as const,
      horizon: "The next two filed reports",
      thesis: "Cash recovery",
      invalidate: "Cash keeps falling",
      next: "Read the next filed report",
    };
    const stale = proposeThesisReview("Original thesis", review).note!;
    workspace.note(result.listingId, "Intervening edit");
    workspace.note(result.listingId, stale, "Original thesis");
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Intervening edit");
    const next = proposeThesisReview("Intervening edit", review).note!;
    workspace.note(result.listingId, next, "Intervening edit");
    expect(api.save).not.toHaveBeenCalled();
    const saving = workspace.coordinator.save();
    workspace.note(result.listingId, "Blocked during Save", next);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(next);
    await saving;
    expect(api.save).toHaveBeenCalledOnce();
    expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual({
      ...initial,
      memberships: [
        { ...initial.memberships[0]!, note: next },
        initial.memberships[1]!,
      ],
    });
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      { ...initial.memberships[0]!, note: next },
      initial.memberships[1]!,
    ]);
    for (const read of [
      api.eodHistory,
      api.annualReport,
      api.recentFilings,
      api.economicCalendar,
      api.monetaryAnnouncements,
    ])
      expect(read).not.toHaveBeenCalled();
    workspace.coordinator.retire();
    workspace.note(result.listingId, stale, next);
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
  });
});

describe("Fed announcement appended to one current draft note", () => {
  async function noteFixture(raw = fedAnnouncementsFixture()) {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(result), note: "First thesis" },
        { ...listingMembership(second), note: "Other share class thesis" },
      ],
    });
    await ready(setup.workspace);
    const response = parseManagedMonetaryAnnouncements(raw)!;
    expect(response).not.toBeNull();
    vi.mocked(setup.api.monetaryAnnouncements).mockResolvedValue(response);
    setup.workspace.setView("markets");
    await setup.workspace.announcements.load();
    const capture = (): FedAnnouncementNoteCapture => {
      const state = setup.workspace.announcements.getSnapshot();
      return {
        response: state.announcements!,
        item: state.announcements!.items[0]!,
        showingPrevious: state.showingPrevious,
      };
    };
    const member = (listingId = result.listingId) =>
      setup.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find((entry) => entry.listingId === listingId)!;
    const counts = () =>
      [
        setup.api.monetaryAnnouncements,
        setup.api.economicCalendar,
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
        workspace.appendFedAnnouncementToNote(selected, staleMember).appended,
      ).toBe(false);
      const originalCounts = counts();
      const excerpt = getFedAnnouncementNoteEvidence(selected).excerpt!;
      expect(
        workspace.getFedAnnouncementNoteAction(selected, member(listingId)),
      ).toEqual({ canAppend: true, reason: null });
      expect(
        workspace.appendFedAnnouncementToNote(selected, member(listingId))
          .appended,
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
      const reopened = new ManagedWorkspace(api, session, undefined, {
        researchCoverage: inventedManagedResearchCoverage,
      });
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
      workspace.appendFedAnnouncementToNote(capture(), member(second.listingId))
        .appended,
    ).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft!.memberships[0]).toEqual(
      before.memberships[0],
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(api.monetaryAnnouncements).toHaveBeenCalledOnce();
  });

  it("refuses a canonically identical duplicate after Save and allows a different original retrieval", async () => {
    const raw = fedAnnouncementsFixture();
    const { workspace, api, capture, member } = await noteFixture({
      ...raw,
      items: [{ ...raw.items[0]!, title: "Cafe\u0301 policy" }, raw.items[1]!],
    });
    const original = capture();
    const excerpt = getFedAnnouncementNoteEvidence(original).excerpt!;
    expect(excerpt).toContain("Cafe\u0301 policy");
    expect(
      workspace.appendFedAnnouncementToNote(original, member()).appended,
    ).toBe(true);
    const duplicate =
      "This exact announcement reference is already in the note draft.";
    expect(workspace.appendFedAnnouncementToNote(original, member())).toEqual({
      appended: false,
      message: duplicate,
    });
    await workspace.coordinator.save();
    await workspace.coordinator.load();
    expect(member().note).toContain("Café policy");
    const before = workspace.coordinator.getSnapshot().draft;
    expect(workspace.getFedAnnouncementNoteAction(original, member())).toEqual({
      canAppend: false,
      reason: duplicate,
    });
    expect(
      workspace.appendFedAnnouncementToNote(original, member()).appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    const replacement = parseManagedMonetaryAnnouncements({
      ...original.response,
      fetchedAt: "2026-10-21T18:00:00.000Z",
    })!;
    vi.mocked(api.monetaryAnnouncements).mockResolvedValueOnce(replacement);
    await workspace.announcements.load();
    expect(
      workspace.appendFedAnnouncementToNote(capture(), member()).appended,
    ).toBe(true);
    expect(member().note).toContain("2026-10-20T18:00:00.000Z");
    expect(member().note).toContain("2026-10-21T18:00:00.000Z");
    expect(api.save).toHaveBeenCalledOnce();
  });

  it.each(["exact", "overflow", "control", "format"] as const)(
    "checks the complete latest raw note at %s without truncating it",
    async (boundary) => {
      const { workspace, capture, member } = await noteFixture();
      const selected = capture();
      const excerpt = getFedAnnouncementNoteEvidence(selected).excerpt!;
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
        workspace.getFedAnnouncementNoteAction(selected, member()).canAppend,
      ).toBe(accepted);
      expect(
        workspace.appendFedAnnouncementToNote(selected, member()).appended,
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
      expect(
        workspace.appendFedAnnouncementToNote(capture(), destination),
      ).toEqual({
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
      let selected: FedAnnouncementNoteCapture | null = original;
      if (kind === "missing") selected = null;
      if (kind === "copied item")
        selected = { ...original, item: { ...original.item } };
      if (kind === "copied response")
        selected = { ...original, response: { ...original.response } };
      if (kind === "equal replacement" || kind === "empty replacement") {
        const replacement = parseManagedMonetaryAnnouncements(
          kind === "equal replacement"
            ? original.response
            : { ...original.response, availableItemCount: 0, items: [] },
        )!;
        vi.mocked(api.monetaryAnnouncements).mockResolvedValueOnce(replacement);
        await workspace.announcements.load();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendFedAnnouncementToNote(selected, member()).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("refuses an append triggered synchronously by the busy publication", async () => {
    const { workspace, api, capture, member } = await noteFixture();
    const original = capture();
    const destination = member();
    const held = deferred<PersonalMonetaryAnnouncementsDto>();
    vi.mocked(api.monetaryAnnouncements).mockReturnValueOnce(held.promise);
    const attempted: boolean[] = [];
    const unsubscribe = workspace.announcements.subscribe(() => {
      if (workspace.announcements.getSnapshot().busy)
        attempted.push(
          workspace.appendFedAnnouncementToNote(original, destination).appended,
        );
    });
    const before = workspace.coordinator.getSnapshot().draft;
    const pending = workspace.announcements.load();
    expect(attempted).toEqual([false]);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.announcements.cancel();
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
      vi.mocked(api.monetaryAnnouncements).mockRejectedValueOnce(
        new TrialApiError(code),
      );
      await workspace.announcements.load();
      expect(workspace.announcements.getSnapshot().announcements).toBe(
        response,
      );
      expect(
        workspace.appendFedAnnouncementToNote(original, member()).appended,
      ).toBe(false);
      expect(
        workspace.appendFedAnnouncementToNote(capture(), member()).appended,
      ).toBe(true);
      expect(member().note).toContain(
        "Retained previous feed; a newer feed was not confirmed.",
      );
      expect(member().note).toContain(response.fetchedAt);
    },
  );

  it.each(["success", "authentication error"] as const)(
    "blocks a held request, permits Cancel, and ignores its late %s after append",
    async (late) => {
      const { workspace, api, capture, member, response } = await noteFixture();
      const held = deferred<PersonalMonetaryAnnouncementsDto>();
      vi.mocked(api.monetaryAnnouncements).mockReturnValueOnce(held.promise);
      const pending = workspace.announcements.load();
      expect(
        workspace.appendFedAnnouncementToNote(capture(), member()),
      ).toEqual({
        appended: false,
        message: "Wait for the announcements request to finish or cancel it.",
      });
      workspace.announcements.cancel();
      expect(
        vi.mocked(api.monetaryAnnouncements).mock.calls[1]![0].aborted,
      ).toBe(true);
      expect(
        workspace.appendFedAnnouncementToNote(capture(), member()).appended,
      ).toBe(true);
      const after = workspace.coordinator.getSnapshot().draft;
      if (late === "success")
        held.resolve(
          parseManagedMonetaryAnnouncements({
            ...response,
            availableItemCount: 0,
            items: [],
          })!,
        );
      else held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.coordinator.getSnapshot().draft).toBe(after);
      expect(workspace.announcements.getSnapshot().announcements).toBe(
        response,
      );
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
        vi.mocked(api.monetaryAnnouncements).mockRejectedValueOnce(
          new TrialApiError("unauthenticated"),
        );
        await workspace.announcements.load();
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendFedAnnouncementToNote(selected, destination).appended,
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
        workspace.appendFedAnnouncementToNote(selected, member()).appended,
      ).toBe(false);
      held.reject(new TrialApiError(code));
      await pending;
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendFedAnnouncementToNote(selected, member()).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      if (code === "conflict") {
        await workspace.coordinator.load();
        workspace.coordinator.keepDraft();
      } else await workspace.coordinator.reconcile();
      expect(
        workspace.appendFedAnnouncementToNote(selected, member()).appended,
      ).toBe(true);
    },
  );
});

describe("explicit in-company watchlist navigation", () => {
  const zero = listingMembership({
    ...eodSelection.listing,
    cik: "0000000001",
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  });
  const otherClass = {
    ...zero,
    listingId: "listing-zero-c",
    securityId: "security-zero-c",
    shareClassId: "class-zero-c",
    shareClassName: "Class C",
    symbol: "ZEROC",
  };
  async function companyFixture(
    section: ManagedResearchVisit["section"] = "annual",
  ) {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...zero, note: "Original ZERO note" },
        { ...listingMembership(second), note: "Original OTHER note" },
        { ...otherClass, note: "Separate Class C note" },
      ],
    });
    await ready(setup.workspace);
    setup.workspace.setView("watchlist");
    setup.workspace.openWatchlistAnnual(
      setup.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    if (section === "eod") setup.workspace.switchToEod();
    if (section === "filings") setup.workspace.switchToFilings();
    return setup;
  }
  function target(workspace: ManagedWorkspace) {
    return workspace.coordinator
      .getSnapshot()
      .draft!.memberships.find(
        (member) => member.listingId === second.listingId,
      )!;
  }
  function expectNoSourceRead(api: ManagedApi) {
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.monetaryAnnouncements).not.toHaveBeenCalled();
  }

  it.each(["annual", "eod", "filings"] as const)(
    "opens another full identity in %s unloaded and preserves the complete draft until explicit Save",
    async (section) => {
      const { workspace, api, saved } = await companyFixture(section);
      workspace.note(zero.listingId, "Current unsaved ZERO thesis");
      workspace.move(second.listingId, -1);
      const before = workspace.coordinator.getSnapshot().draft!;
      const visit = workspace.getSnapshot().research!;
      const choices = workspace.getResearchCompanyNavigation(visit);
      expect(choices).toEqual({ members: before.memberships, reason: "" });
      expect(choices.members).toBe(before.memberships);
      expect(choices.members.map((member) => member.listingId)).toEqual([
        second.listingId,
        zero.listingId,
        otherClass.listingId,
      ]);
      expect(workspace.getSnapshot().research).toBe(visit);
      expect(workspace.canOpenResearchCompany(visit, target(workspace))).toBe(
        true,
      );
      workspace.openResearchCompany(visit, target(workspace));
      const opened = workspace.getSnapshot().research!;
      expect(opened).toMatchObject({
        section,
        selection: {
          origin: "watchlist",
          cik: null,
          catalogSnapshotSha256: digest,
          listing: { listingId: second.listingId },
        },
      });
      // The exact second identity replaces all eleven fields, not just the ticker.
      expect(opened.selection.listing).toEqual(
        Object.fromEntries(
          Object.entries(target(workspace)).filter(([key]) => key !== "note"),
        ),
      );
      expect(workspace[section].getSnapshot()).toMatchObject({
        response: null,
        running: false,
      });
      for (const other of ["annual", "eod", "filings"] as const)
        if (other !== section)
          expect(workspace[other].getSnapshot().selection).toBeNull();
      workspace.openResearchCompany(opened, before.memberships[2]!);
      expect(workspace.getSnapshot().research?.selection.listing).toEqual(
        Object.fromEntries(
          Object.entries(otherClass).filter(([key]) => key !== "note"),
        ),
      );
      expect(workspace.getSnapshot().research?.section).toBe(section);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expectNoSourceRead(api);
      expect(api.save).not.toHaveBeenCalled();
      workspace.closeResearch();
      await workspace.coordinator.save();
      expect(saved()).toEqual({ version: 2, payload: before });
      await workspace.coordinator.load();
      expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
      expect(api.save).toHaveBeenCalledOnce();
    },
  );

  it.each(["annual", "eod", "filings"] as const)(
    "same-company %s Open preserves accepted data and a pending refresh",
    async (section) => {
      const { workspace, api } = await companyFixture(section);
      vi.mocked(api.annualReport).mockResolvedValue(await annualResponse());
      vi.mocked(api.eodHistory).mockResolvedValue(eodResponse());
      vi.mocked(api.recentFilings).mockResolvedValue(filingsResponse());
      const model = workspace[section];
      await model.load();
      expect(model.getSnapshot().response).not.toBeNull();
      const held = deferred<never>();
      const read =
        section === "annual"
          ? api.annualReport
          : section === "eod"
            ? api.eodHistory
            : api.recentFilings;
      vi.mocked(read).mockReturnValueOnce(held.promise);
      const pending = model.load();
      const before = model.getSnapshot();
      const visit = workspace.getSnapshot().research!;
      const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      expect(workspace.canOpenResearchCompany(visit, member)).toBe(false);
      workspace.openResearchCompany(visit, member);
      expect(workspace.getSnapshot().research).toBe(visit);
      expect(model.getSnapshot()).toBe(before);
      expect(vi.mocked(read).mock.calls[1]![1].aborted).toBe(false);
      workspace.closeResearch();
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("allows a readable conflict draft and raw invalid notes without editing or saving them", async () => {
    const { workspace, api } = await companyFixture();
    workspace.note(zero.listingId, "Dirty before conflict");
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    const conflict = workspace.coordinator.getSnapshot().draft;
    expect(workspace.coordinator.getSnapshot().conflict).toBe(true);
    workspace.openResearchCompany(
      workspace.getSnapshot().research!,
      target(workspace),
    );
    expect(workspace.getSnapshot().research?.selection.listing.listingId).toBe(
      second.listingId,
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(conflict);
    expect(api.save).toHaveBeenCalledOnce();
    expectNoSourceRead(api);

    const editable = await companyFixture();
    editable.workspace.note(zero.listingId, "Raw\ninvalid note");
    const raw = editable.workspace.coordinator.getSnapshot().draft;
    editable.workspace.openResearchCompany(
      editable.workspace.getSnapshot().research!,
      target(editable.workspace),
    );
    expect(
      editable.workspace.getSnapshot().research?.selection.listing.listingId,
    ).toBe(second.listingId);
    expect(editable.workspace.coordinator.getSnapshot().draft).toBe(raw);
    expect(raw!.memberships[0]!.note).toBe("Raw\ninvalid note");
    expect(editable.api.save).not.toHaveBeenCalled();
  });

  it("exposes an explicit empty or mismatched draft reason without a fallback company", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.openDiscoveryAnnual(result);
    const visit = workspace.getSnapshot().research!;
    expect(workspace.getResearchCompanyNavigation(visit)).toEqual({
      members: [],
      reason: "My Watchlist has no companies.",
    });
    workspace.coordinator.replaceDraft({
      ...empty,
      snapshotSha256: nextDigest,
      memberships: [listingMembership(second)],
    });
    expect(workspace.getResearchCompanyNavigation(visit)).toEqual({
      members: [],
      reason: "Load My Watchlist from the current catalog first.",
    });
    workspace.openResearchCompany(visit, target(workspace));
    expect(workspace.getSnapshot().research).toBe(visit);
    expectNoSourceRead(api);
  });

  it.each([
    "note",
    "identity",
    "removed",
    "section",
    "visit",
    "catalog",
    "retired",
    "navigation",
  ] as const)(
    "refuses a captured action after %s changes",
    async (boundary) => {
      const { workspace, api } = await companyFixture();
      const visit = workspace.getSnapshot().research!;
      const member = target(workspace);
      if (boundary === "note")
        workspace.note(member.listingId, "New note handle");
      if (boundary === "identity") {
        const draft = workspace.coordinator.getSnapshot().draft!;
        workspace.coordinator.replaceDraft({
          ...draft,
          memberships: draft.memberships.map((row) =>
            row === member
              ? { ...row, issuerName: "Replacement identity" }
              : row,
          ),
        });
      }
      if (boundary === "removed") workspace.remove(member.listingId);
      if (boundary === "section") workspace.switchToFilings();
      if (boundary === "visit") workspace.openWatchlistAnnual(member);
      if (boundary === "catalog") {
        vi.mocked(api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      }
      if (boundary === "retired") workspace.coordinator.retire();
      if (boundary === "navigation") workspace.setNavigationBlocked(true);
      const before = workspace.getSnapshot();
      expect(workspace.canOpenResearchCompany(visit, member)).toBe(false);
      workspace.openResearchCompany(visit, member);
      expect(workspace.getSnapshot()).toBe(before);
      if (boundary === "note")
        expect(workspace.canOpenResearchCompany(visit, target(workspace))).toBe(
          true,
        );
      expectNoSourceRead(api);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("keeps exact current choices while the initial company route is pending and blocks Open until ready", async () => {
    const { workspace, api } = await companyFixture();
    const visit = workspace.getSnapshot().research!;
    const draft = workspace.coordinator.getSnapshot().draft!;
    const current = draft.memberships[0]!;
    const other = target(workspace);
    const annual = workspace.annual.getSnapshot();
    const choices = workspace.getResearchCompanyNavigation(visit);
    workspace.setNavigationBlocked(true);

    const pending = workspace.getResearchCompanyNavigation(visit);
    expect(pending.members).toBe(choices.members);
    expect(pending.members).toBe(draft.memberships);
    expect(pending.members[0]).toBe(current);
    expect(pending.reason).toBe("Wait for company navigation to finish.");
    expect(workspace.canOpenResearchCompany(visit, current)).toBe(false);
    expect(workspace.canOpenResearchCompany(visit, other)).toBe(false);
    const blocked = workspace.getSnapshot();
    workspace.openResearchCompany(visit, other);
    expect(workspace.getSnapshot()).toBe(blocked);
    expect(workspace.annual.getSnapshot()).toBe(annual);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);

    await workspace.setCompanyRoute({
      kind: "company",
      listingId: current.listingId,
      section: "annual",
    });
    const readyVisit = workspace.getSnapshot().research!;
    const readyChoices = workspace.getResearchCompanyNavigation(readyVisit);
    expect(readyVisit.selection).toBe(visit.selection);
    expect(readyChoices.members).toBe(pending.members);
    expect(readyChoices.reason).toBe("");
    expect(workspace.canOpenResearchCompany(readyVisit, current)).toBe(false);
    expect(workspace.canOpenResearchCompany(readyVisit, other)).toBe(true);
    const readyState = workspace.getSnapshot();
    workspace.openResearchCompany(readyVisit, current);
    expect(workspace.getSnapshot()).toBe(readyState);
    expect(workspace.annual.getSnapshot()).toBe(annual);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expectNoSourceRead(api);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("admits the exact established company route despite its persistent navigation block", async () => {
    const { workspace, api } = await companyFixture("filings");
    workspace.setNavigationBlocked(true);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "filings",
    });
    const visit = workspace.getSnapshot().research!;
    expect(workspace.getSnapshot().companyRoute?.status).toBe("open");
    expect(workspace.getResearchCompanyNavigation(visit).reason).toBe("");
    workspace.openResearchCompany(visit, target(workspace));
    expect(workspace.getSnapshot().research).toMatchObject({
      section: "filings",
      selection: { listing: { listingId: second.listingId } },
    });
    expectNoSourceRead(api);
  });

  it.each(["annual", "eod", "filings"] as const)(
    "cancels %s and fences its late authentication error after the explicit company switch",
    async (section) => {
      const { workspace, api } = await companyFixture(section);
      const held = deferred<never>();
      const read =
        section === "annual"
          ? api.annualReport
          : section === "eod"
            ? api.eodHistory
            : api.recentFilings;
      vi.mocked(read).mockReturnValueOnce(held.promise);
      const pending = workspace[section].load();
      workspace.openResearchCompany(
        workspace.getSnapshot().research!,
        target(workspace),
      );
      const accepted = workspace.getSnapshot().research;
      const state = workspace[section].getSnapshot();
      expect(vi.mocked(read).mock.calls[0]![1].aborted).toBe(true);
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.getSnapshot().research).toBe(accepted);
      expect(workspace[section].getSnapshot()).toBe(state);
      expect(state.selection?.listing.listingId).toBe(second.listingId);
      expect(state.response).toBeNull();
      expect(read).toHaveBeenCalledOnce();
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "cooldown"] as const)(
    "clears both accepted Filings lists and fences a late %s from the old company",
    async (outcome) => {
      const { workspace, api } = await companyFixture("filings");
      vi.mocked(api.recentFilings).mockResolvedValueOnce(filingsResponse(2));
      await workspace.filings.load();
      vi.mocked(api.recentFilings).mockResolvedValueOnce(filingsResponse(3));
      await workspace.filings.load();
      expect(
        workspace.filings.getSnapshot().refreshComparison?.newAccessions,
      ).toHaveLength(1);
      const held = deferred<Awaited<ReturnType<ManagedApi["recentFilings"]>>>();
      vi.mocked(api.recentFilings).mockReturnValueOnce(held.promise);
      const pending = workspace.filings.load();
      workspace.openResearchCompany(
        workspace.getSnapshot().research!,
        target(workspace),
      );
      const state = workspace.filings.getSnapshot();
      expect(state).toMatchObject({
        response: null,
        refreshComparison: null,
        running: false,
      });
      if (outcome === "success") held.resolve(filingsResponse(4));
      else
        held.reject(
          new ManagedSecCooldownError(
            new Date(Date.now() + 60_000).toISOString(),
          ),
        );
      await pending;
      expect(workspace.filings.getSnapshot()).toBe(state);
      vi.mocked(api.recentFilings).mockResolvedValueOnce(
        filingsResponse(1, "available", state.selection!),
      );
      await workspace.filings.load();
      expect(api.recentFilings).toHaveBeenCalledTimes(4);
      expect(
        workspace.filings.getSnapshot().response?.issuer.filings,
      ).toHaveLength(1);
      expect(workspace.filings.getSnapshot().refreshComparison).toBeNull();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["clear", "inner-close", "open"] as const)(
    "rechecks a removed target during %s publication",
    async (boundary) => {
      const { workspace, api } = await companyFixture();
      const visit = workspace.getSnapshot().research!;
      const member = target(workspace);
      const published: (ManagedResearchVisit | null)[] = [];
      const stopPublications = workspace.subscribe(() =>
        published.push(workspace.getSnapshot().research),
      );
      let emptyPublications = 0;
      let changed = false;
      const unsubscribe = workspace.annual.subscribe(() => {
        const selection = workspace.annual.getSnapshot().selection;
        if (!selection) emptyPublications++;
        if (
          !changed &&
          ((boundary === "clear" && emptyPublications === 1) ||
            (boundary === "inner-close" && emptyPublications === 2) ||
            (boundary === "open" &&
              selection?.listing.listingId === member.listingId))
        ) {
          changed = true;
          workspace.remove(member.listingId);
        }
      });
      workspace.openResearchCompany(visit, member);
      unsubscribe();
      stopPublications();
      expect(changed).toBe(true);
      expect(workspace.getSnapshot().research).toBeNull();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(published).toEqual([null]);
      expectNoSourceRead(api);
    },
  );

  it.each(["clear", "inner-close", "open"] as const)(
    "preserves a nested replacement visit during %s instead of stale cleanup",
    async (boundary) => {
      const { workspace, api } = await companyFixture();
      const visit = workspace.getSnapshot().research!;
      const member = target(workspace);
      const replacement =
        workspace.coordinator.getSnapshot().draft!.memberships[2]!;
      let emptyPublications = 0;
      let changed = false;
      const unsubscribe = workspace.annual.subscribe(() => {
        const selection = workspace.annual.getSnapshot().selection;
        if (!selection) emptyPublications++;
        if (
          !changed &&
          ((boundary === "clear" && emptyPublications === 1) ||
            (boundary === "inner-close" && emptyPublications === 2) ||
            (boundary === "open" &&
              selection?.listing.listingId === member.listingId))
        ) {
          changed = true;
          workspace.openWatchlistEod(replacement);
        }
      });
      workspace.openResearchCompany(visit, member);
      unsubscribe();
      expect(changed).toBe(true);
      expect(workspace.getSnapshot().research).toMatchObject({
        section: "eod",
        selection: { listing: { listingId: replacement.listingId } },
      });
      expect(workspace.eod.getSnapshot().selection?.listing.listingId).toBe(
        replacement.listingId,
      );
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expectNoSourceRead(api);
    },
  );

  it("refuses a same-flag navigation publication during cancellation of a routed visit", async () => {
    const { workspace, api } = await companyFixture();
    workspace.setNavigationBlocked(true);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "annual",
    });
    const held = deferred<never>();
    vi.mocked(api.annualReport).mockImplementationOnce((_request, signal) => {
      signal.addEventListener(
        "abort",
        () => workspace.setNavigationBlocked(true),
        { once: true },
      );
      return held.promise;
    });
    const pending = workspace.annual.load();
    const visit = workspace.getSnapshot().research!;
    const publication = vi.fn();
    const stopPublications = workspace.subscribe(publication);
    expect(workspace.canOpenResearchCompany(visit, target(workspace))).toBe(
      true,
    );
    workspace.openResearchCompany(visit, target(workspace));
    stopPublications();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(publication).toHaveBeenCalledOnce();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe("managed workspace composition", () => {
  it("loads the agenda independently of catalog and watchlist work without changing a draft", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    workspace.coordinator.replaceDraft({
      ...empty,
      memberships: [
        {
          ...listingMembership(result),
          note: "Retained calendar research draft",
        },
      ],
    });
    const before = workspace.coordinator.getSnapshot();
    workspace.setView("markets");
    vi.mocked(api.economicCalendar).mockResolvedValue(
      economicCalendarFixture(),
    );
    expect(api.economicCalendar).not.toHaveBeenCalled();
    await workspace.agenda.load();
    expect(workspace.agenda.getSnapshot().agenda).toEqual(
      economicCalendarFixture(),
    );
    expect(workspace.coordinator.getSnapshot()).toBe(before);
    expect(api.status).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
  });

  it("keeps the agenda through company research, cancels when leaving Markets and fences a late session error", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    workspace.note(result.listingId, "Unchanged draft while reading calendar");
    workspace.setView("markets");
    const before = workspace.coordinator.getSnapshot();
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(
      economicCalendarFixture(),
    );
    await workspace.agenda.load();
    const agenda = workspace.agenda.getSnapshot().agenda;
    workspace.openWatchlistAnnual(before.draft!.memberships[0]!);
    expect(workspace.getSnapshot().research?.section).toBe("annual");
    expect(workspace.agenda.getSnapshot().agenda).toBe(agenda);
    const held =
      deferred<Awaited<ReturnType<ManagedApi["economicCalendar"]>>>();
    vi.mocked(api.economicCalendar).mockReturnValueOnce(held.promise);
    const pending = workspace.agenda.load();
    workspace.closeResearch();
    expect(workspace.agenda.getSnapshot().busy).toBe(true);
    workspace.setView("watchlist");
    expect(vi.mocked(api.economicCalendar).mock.calls[1]![0].aborted).toBe(
      true,
    );
    workspace.setView("markets");
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(workspace.agenda.getSnapshot()).toMatchObject({
      agenda,
      busy: false,
      showingPrevious: true,
      error: null,
    });
    expect(workspace.coordinator.getSnapshot()).toBe(before);
    expect(api.economicCalendar).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("retires the shared workspace on current agenda authentication loss and aborts agenda work on other session rejection", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    workspace.setView("markets");
    vi.mocked(api.economicCalendar).mockRejectedValueOnce(
      new TrialApiError("unauthenticated"),
    );
    await workspace.agenda.load();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      saved: null,
      draft: null,
    });
    expect(workspace.agenda.getSnapshot().agenda).toBeNull();
    const second = fixture();
    await second.workspace.coordinator.load();
    second.workspace.setView("markets");
    const held =
      deferred<Awaited<ReturnType<ManagedApi["economicCalendar"]>>>();
    vi.mocked(second.api.economicCalendar).mockReturnValueOnce(held.promise);
    const pending = second.workspace.agenda.load();
    second.workspace.coordinator.readError(new TrialApiError("access_denied"));
    expect(
      vi.mocked(second.api.economicCalendar).mock.calls[0]![0].aborted,
    ).toBe(true);
    held.resolve(economicCalendarFixture());
    await pending;
    expect(second.workspace.agenda.getSnapshot()).toMatchObject({
      agenda: null,
      busy: false,
    });
    expect(second.workspace.coordinator.getSnapshot().phase).toBe("retired");
  });
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
    const reopened = new ManagedWorkspace(api, session, undefined, {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: [
        eodSelection.listing,
        listingMembership(result),
        listingMembership(second),
      ],
    });
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
    const researchWatchlist = workspace.getResearchWatchlist(selection);
    expect(typeof researchWatchlist.revision).toBe("symbol");
    expect(researchWatchlist).toEqual({
      revision: researchWatchlist.revision,
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
    const reopened = new ManagedWorkspace(
      api,
      session,
      undefined,
      workspaceFixtureOptions(inventedManagedResearchCoverage),
    );
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
      const researchWatchlist = workspace.getResearchWatchlist(selection);
      expect(typeof researchWatchlist.revision).toBe("symbol");
      expect(researchWatchlist).toEqual({
        revision: researchWatchlist.revision,
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
      researchCoverage: inventedManagedResearchCoverage,
      marketsCohort: cohort,
      priceCoverage: cohort,
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
        researchCoverage: inventedManagedResearchCoverage,
        marketsCohort: cohort,
        priceCoverage: cohort,
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
          carried.rows.at(-1)!,
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

  it("shares a watchlist price deadline with company and Markets reads across view changes", async () => {
    const { workspace, api } = await marketFixture();
    workspace.setView("watchlist");
    const draft = workspace.coordinator.getSnapshot().draft;
    const row = workspace.watchlistPrices.getSnapshot().rows[0]!;
    const clock = vi.spyOn(Date, "now");
    const now = Date.now();
    clock.mockReturnValue(now);
    const deadline = new Date(now + 60_000).toISOString();
    try {
      vi.mocked(api.eodHistory).mockRejectedValueOnce(
        new ManagedEodCooldownError(deadline),
      );
      await workspace.loadWatchlistPrice(row.handle);
      expect(
        workspace.watchlistPrices.getSnapshot().rows[0]!.history.message,
      ).toContain(deadline);
      workspace.openWatchlistEod(draft!.memberships[0]!);
      await workspace.eod.load();
      expect(workspace.eod.getSnapshot().message).toContain(deadline);
      workspace.closeResearch();
      workspace.setView("markets");
      await workspace.markets.loadSelected();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      workspace.setView("watchlist");
      const replacement = workspace.watchlistPrices.getSnapshot().rows[0]!;
      expect(replacement.handle).not.toBe(row.handle);
      await workspace.loadWatchlistPrice(replacement.handle);
      expect(api.eodHistory).toHaveBeenCalledOnce();
      clock.mockReturnValue(now + 60_001);
      expect(api.eodHistory).toHaveBeenCalledOnce();
      await workspace.loadWatchlistPrice(replacement.handle);
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      expect(
        workspace.watchlistPrices.getSnapshot().rows[0]!.history.response
          ?.security,
      ).toEqual(replacement.listing);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.save).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

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
            ? new ManagedSecCooldownError(nextAllowedAt)
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
            new ManagedSecCooldownError(nextAllowedAt),
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
    expect(
      workspace.getPriceNoteAction(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ),
    ).toEqual({
      canAppend: true,
      reason: null,
    });
    const latest = "  Cafe\u0301 thesis updated after rendering  ";
    workspace.note(zero.listingId, latest);
    const before = workspace.coordinator.getSnapshot().draft!;
    const expected =
      latest +
      " " +
      priceComparisonNoteExcerpt(
        response,
        start,
        response.rows.at(-1)!,
        false,
      )!;
    expect(
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ),
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
    const reopened = new ManagedWorkspace(api, session, undefined, {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: [
        eodSelection.listing,
        listingMembership(result),
        listingMembership(second),
      ],
    });
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
    expect(
      saved().payload.memberships.map((member) => member.listingId),
    ).toEqual([second.listingId, zero.listingId]);
  });

  it("appends a past interval, keeps the latest quote and preserves the complete draft through Back", async () => {
    const { workspace, api, selection } = await noteFixture();
    const response = {
      ...eodResponse(),
      rows: [
        { date: "2026-09-17", close: "100" },
        { date: "2026-09-18", close: "110" },
        { date: "2026-09-19", close: "90" },
      ],
    };
    vi.mocked(api.eodHistory).mockResolvedValueOnce(response);
    await workspace.eod.load();
    const before = workspace.coordinator.getSnapshot().draft!;
    const start = response.rows[0]!;
    const end = response.rows[1]!;
    expect(
      workspace.getPriceNoteAction(selection, response, start, end).canAppend,
    ).toBe(true);
    expect(
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        end,
      ).appended,
    ).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships).toEqual([
      before.memberships[0],
      {
        ...before.memberships[1],
        note: `Original thesis ${priceComparisonNoteExcerpt(response, start, end, false)}`,
      },
    ]);
    expect(draft.memberships[1]!.note).toContain(
      "2026-09-17 USD 100 to 2026-09-18 USD 110; raw close change +$10 (+10.0000%).",
    );
    expect(workspace.eod.getSnapshot().response).toBe(response);
    expect(response.rows.at(-1)).toEqual({ date: "2026-09-19", close: "90" });
    workspace.closeResearch();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("supports a Price section first opened from Annual without requiring the two model selections to be the same object", async () => {
    const { workspace, api, response, start } = await noteFixture();
    workspace.openDiscoveryAnnual(zero);
    const selection = workspace.getSnapshot().research!.selection;
    workspace.switchToEod();
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot().selection).not.toBe(selection);
    expect(
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ).appended,
    ).toBe(true);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each([
    "copied selection",
    "copied response",
    "copied row",
    "copied end",
    "foreign end",
    "equal endpoints",
    "reversed endpoints",
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
      let end = response.rows.at(-1)!;
      let capturedResponse = response;
      if (boundary === "copied selection") selection = { ...selection };
      else if (boundary === "copied response")
        capturedResponse = { ...response };
      else if (boundary === "copied row") start = { ...start };
      else if (boundary === "copied end") end = { ...end };
      else if (boundary === "foreign end")
        end = { date: "2026-09-21", close: "120" };
      else if (boundary === "equal endpoints") end = start;
      else if (boundary === "reversed endpoints") [start, end] = [end, start];
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
        workspace.getPriceNoteAction(selection, capturedResponse, start, end)
          .canAppend,
      ).toBe(false);
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          capturedResponse,
          start,
          end,
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
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ),
    ).toEqual({
      appended: false,
      message: "Wait for the close history request to finish or cancel it.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.eod.cancel();
    expect(
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ).appended,
    ).toBe(true);
    const appended = workspace.coordinator.getSnapshot().draft;
    expect(appended?.memberships[1]?.note).toBe(
      "Original thesis " +
        priceComparisonNoteExcerpt(
          response,
          start,
          response.rows.at(-1)!,
          true,
        ),
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
      workspace.appendPriceComparisonToResearchNote(
        selection,
        response,
        start,
        response.rows.at(-1)!,
      ).appended,
    ).toBe(retained);
    if (retained) {
      expect(workspace.eod.getSnapshot().response).toBe(response);
      expect(
        workspace.coordinator.getSnapshot().draft?.memberships[1]?.note,
      ).toBe(
        "Original thesis " +
          priceComparisonNoteExcerpt(
            response,
            start,
            response.rows.at(-1)!,
            true,
          ),
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
          response.rows.at(-1)!,
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
        workspace.getPriceNoteAction(
          selection,
          response,
          start,
          response.rows.at(-1)!,
        ).canAppend,
      ).toBe(false);
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
          response.rows.at(-1)!,
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
      const excerpt = priceComparisonNoteExcerpt(
        response,
        start,
        response.rows.at(-1)!,
        false,
      )!;
      const room = 2000 - [...excerpt].length - 1;
      workspace.note(zero.listingId, unit.repeat(room + 1));
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
          response.rows.at(-1)!,
        ).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      workspace.note(zero.listingId, unit.repeat(room));
      expect(
        workspace.appendPriceComparisonToResearchNote(
          selection,
          response,
          start,
          response.rows.at(-1)!,
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
          response.rows.at(-1)!,
        ).appended,
      ).toBe(note === "");
      if (note === "")
        expect(
          workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
        ).toBe(
          priceComparisonNoteExcerpt(
            response,
            start,
            response.rows.at(-1)!,
            false,
          ),
        );
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
  async function noteFixture(note = "Original thesis", history = false) {
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
    const response = await annualResponse(
      history ? annualHistoryRows() : annualComparativeRows(),
    );
    vi.mocked(api.annualReport).mockResolvedValue(response);
    await ready(workspace);
    workspace.openDiscoveryAnnual(zero);
    await workspace.annual.load();
    const selection = workspace.getSnapshot().research!.selection;
    const pair = viewOf(response).income.resolution.bases.find(
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
    const reopened = new ManagedWorkspace(api, session, undefined, {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: [
        eodSelection.listing,
        listingMembership(result),
        listingMembership(second),
      ],
    });
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

  it.each([
    ["emoji", false],
    ["decomposed", false],
    ["emoji", true],
    ["decomposed", true],
  ] as const)(
    "accepts exactly 2,000 normalized code points with %s (three-period history %s) and rejects overflow without truncation",
    async (kind, history) => {
      const { workspace, api, selection, response, pair } = await noteFixture(
        "Original thesis",
        history,
      );
      const excerpt = annualNoteExcerpt(response, pair, false)!;
      expect(excerpt.includes("Additional same-filing annual period")).toBe(
        history,
      );
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
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
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

describe("filing references appended to the shared note", () => {
  async function noteFixture() {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(second), note: "Other class thesis" },
        { ...listingMembership(result), note: "Initial prose" },
      ],
    });
    const { workspace, api } = setup;
    await ready(workspace);
    workspace.openDiscoveryAnnual(result);
    workspace.switchToFilings();
    const selection = workspace.getSnapshot().research!.selection;
    vi.mocked(api.recentFilings).mockResolvedValue(
      filingsResponse(2, "available", selection),
    );
    await workspace.filings.load();
    const response = workspace.filings.getSnapshot().response!;
    const row = response.issuer.filings[1]!;
    const append = () =>
      workspace.appendFilingReferenceToResearchNote(selection, response, row);
    return { ...setup, selection, response, row, append };
  }
  it("appends to the latest raw prose, preserves the same-CIK other class/order and saves/reloads only explicitly", async () => {
    const { workspace, api, selection, response, row, append, saved } =
      await noteFixture();
    const prose = "  Updated Cafe\u0301 thesis  ";
    workspace.noteResearch(selection, prose);
    const before = workspace.coordinator.getSnapshot().draft!;
    const excerpt = filingReferenceNoteExcerpt(response, row, false)!;
    expect(append()).toEqual({
      appended: true,
      message:
        "Filing reference added to the note draft. Review and save all changes in My Watchlist.",
    });
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft).toEqual({
      ...before,
      memberships: [
        before.memberships[0],
        { ...before.memberships[1], note: prose + " " + excerpt },
      ],
    });
    expect(workspace.coordinator.getSnapshot().baseVersion).toBe(1);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.recentFilings).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    workspace.closeResearch();
    workspace.setView("watchlist");
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships[1]!.note).toBe(
      normalizeWatchlistNote(prose + " " + excerpt),
    );
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(saved().payload);
  });
  it("refuses an identical paragraph, permits removal/readd and keeps a distinct dated observation", async () => {
    const { workspace, api, selection, response, row, append } =
      await noteFixture();
    expect(append().appended).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(append()).toEqual({
      appended: false,
      message: "This exact filing reference is already in the note draft.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.noteResearch(
      selection,
      `Accession mentioned in my prose: ${row.accessionNumber}.`,
    );
    expect(append().appended).toBe(true);
    const replacement = {
      ...filingsResponse(2, "available", selection),
      completedAt: "2026-10-12T00:00:02.000Z",
    };
    vi.mocked(api.recentFilings).mockResolvedValueOnce(replacement);
    await workspace.filings.load();
    const next = workspace.filings.getSnapshot().response!;
    expect(
      workspace.appendFilingReferenceToResearchNote(
        selection,
        next,
        next.issuer.filings[1]!,
      ).appended,
    ).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toContain(response.completedAt);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toContain(next.completedAt);
  });
  it.each([
    "copied selection",
    "copied response",
    "copied row",
    "other listing",
    "closed visit",
    "reopened visit",
    "Annual section",
    "equal replacement",
    "catalog change",
    "retirement",
  ])("rejects captured controls after %s", async (boundary) => {
    const setup = await noteFixture();
    const { workspace, api } = setup;
    let { selection, response, row } = setup;
    if (boundary === "copied selection") selection = { ...selection };
    else if (boundary === "copied response") response = { ...response };
    else if (boundary === "copied row") row = { ...row };
    else if (boundary === "other listing")
      workspace.openDiscoveryAnnual(second);
    else if (boundary === "closed visit") workspace.closeResearch();
    else if (boundary === "reopened visit") {
      workspace.closeResearch();
      workspace.openDiscoveryAnnual(result);
      workspace.switchToFilings();
      await workspace.filings.load();
    } else if (boundary === "Annual section") workspace.switchToAnnual();
    else if (boundary === "equal replacement") await workspace.filings.load();
    else if (boundary === "catalog change") {
      vi.mocked(api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: nextDigest },
      });
      await workspace.refreshCatalog();
    } else workspace.coordinator.retire();
    const before = workspace.coordinator.getSnapshot().draft;
    const reads = vi.mocked(api.recentFilings).mock.calls.length;
    expect(
      workspace.getFilingsNoteAction(selection, response, row).canAppend,
    ).toBe(false);
    expect(
      workspace.appendFilingReferenceToResearchNote(selection, response, row)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.recentFilings).toHaveBeenCalledTimes(reads);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("blocks pending refresh, then appends the retained packet after Cancel and fences its late replacement", async () => {
    const { workspace, api, response, append } = await noteFixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["recentFilings"]>>>();
    vi.mocked(api.recentFilings).mockReturnValueOnce(held.promise);
    const pending = workspace.filings.load();
    expect(append().appended).toBe(false);
    workspace.filings.cancel();
    expect(append().appended).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(draft!.memberships[1]!.note).toContain(
      "Retained previous filings response; newer filings were not confirmed.",
    );
    expect(draft!.memberships[1]!.note).toContain(response.issuer.fetchedAt);
    held.resolve(filingsResponse(0));
    await pending;
    expect(workspace.filings.getSnapshot().response).toBe(response);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
  });
  it.each([
    "transient",
    "upstream_unavailable",
    "rate_limited",
    "valid empty",
    "not_covered",
    "invalid_response",
    "malformed",
    "mismatched identity",
  ] as const)("respects the model's %s replacement policy", async (kind) => {
    const { workspace, api, selection, response, append } = await noteFixture();
    if (kind === "transient")
      vi.mocked(api.recentFilings).mockRejectedValueOnce(
        new TrialApiError("unavailable"),
      );
    else if (kind === "malformed")
      vi.mocked(api.recentFilings).mockResolvedValueOnce({
        ...response,
        completedAt: "invalid",
      });
    else if (kind === "mismatched identity")
      vi.mocked(api.recentFilings).mockResolvedValueOnce({
        ...response,
        security: { ...response.security, shareClassId: "other-class" },
      });
    else
      vi.mocked(api.recentFilings).mockResolvedValueOnce(
        filingsResponse(
          0,
          kind === "valid empty" ? "available" : kind,
          selection,
        ),
      );
    await workspace.filings.load();
    const retained = [
      "transient",
      "upstream_unavailable",
      "rate_limited",
    ].includes(kind);
    expect(append().appended).toBe(retained);
    if (retained)
      expect(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
      ).toContain("Retained previous filings response");
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });
  it.each(["missing member", "changed identity", "stale draft catalog"])(
    "blocks %s",
    async (boundary) => {
      const { workspace, selection, response, row, append } =
        await noteFixture();
      const draft = workspace.coordinator.getSnapshot().draft!;
      workspace.coordinator.replaceDraft({
        ...draft,
        snapshotSha256:
          boundary === "stale draft catalog" ? nextDigest : digest,
        memberships:
          boundary === "missing member"
            ? [draft.memberships[0]!]
            : draft.memberships.map((member, i) =>
                i === 1 && boundary === "changed identity"
                  ? { ...member, shareClassId: "different-class" }
                  : member,
              ),
      });
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.getFilingsNoteAction(selection, response, row).canAppend,
      ).toBe(false);
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    },
  );
  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "does not bypass %s",
    async (boundary) => {
      const { workspace, api, append } = await noteFixture();
      workspace.note(result.listingId, "Changed thesis");
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
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).toHaveBeenCalledTimes(saves);
      if (pending) {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
    },
  );
  it.each(["😀", "e\u0301"])(
    "allows exactly 2,000 normalized codepoints and atomically rejects overflow with %s",
    async (unit) => {
      const { workspace, response, row, selection, append } =
        await noteFixture();
      const excerpt = filingReferenceNoteExcerpt(response, row, false)!;
      const room = 2000 - [...excerpt].length - 1;
      workspace.noteResearch(selection, unit.repeat(room + 1));
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      workspace.noteResearch(selection, unit.repeat(room));
      expect(append().appended).toBe(true);
      expect(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
      ).toBe(unit.repeat(room) + " " + excerpt);
    },
  );
  it.each([
    "private\nline",
    "invisible\u200btext",
    "bad\ud800text",
    "x".repeat(2001),
  ])("preserves an invalid latest note on refusal", async (note) => {
    const { workspace, selection, api, append } = await noteFixture();
    workspace.noteResearch(selection, note);
    const before = workspace.coordinator.getSnapshot().draft;
    expect(append().appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe("workspace SEC filings integration", () => {
  it("keeps all three research sections explicit and retains filings and the full draft through section switches", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const selection = workspace.getSnapshot().research!.selection;
    workspace.noteResearch(selection, "Unsent complete note");
    const draft = workspace.coordinator.getSnapshot().draft;
    workspace.switchToFilings();
    expect(workspace.getSnapshot().research?.section).toBe("filings");
    expect(api.recentFilings).not.toHaveBeenCalled();
    vi.mocked(api.recentFilings).mockResolvedValueOnce(
      filingsResponse(26, "available", selection),
    );
    await workspace.filings.load();
    const response = workspace.filings.getSnapshot().response;
    const held = deferred<Awaited<ReturnType<ManagedApi["recentFilings"]>>>();
    vi.mocked(api.recentFilings).mockReturnValueOnce(held.promise);
    const pending = workspace.filings.load();
    workspace.switchToEod();
    expect(vi.mocked(api.recentFilings).mock.calls[1]![1].aborted).toBe(true);
    held.resolve(filingsResponse(0, "available", selection));
    await pending;
    workspace.switchToFilings();
    expect(workspace.filings.getSnapshot().response).toBe(response);
    expect(workspace.filings.getSnapshot().showingPrevious).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
    workspace.closeResearch();
    expect(workspace.filings.getSnapshot().response).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
  });
  it.each(["annual", "filings"] as const)(
    "shares a checked %s deadline with the other SEC section without blocking Price",
    async (origin) => {
      const { workspace, api } = fixture();
      await ready(workspace);
      workspace.add(result);
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
      const deadline = new Date(Date.now() + 60_000).toISOString();
      if (origin === "annual") {
        vi.mocked(api.annualReport).mockRejectedValueOnce(
          new ManagedSecCooldownError(deadline),
        );
        await workspace.annual.load();
        workspace.switchToFilings();
        await workspace.filings.load();
        expect(api.recentFilings).not.toHaveBeenCalled();
        expect(workspace.filings.getSnapshot().message).toContain(deadline);
      } else {
        workspace.switchToFilings();
        vi.mocked(api.recentFilings).mockRejectedValueOnce(
          new ManagedSecCooldownError(deadline),
        );
        await workspace.filings.load();
        workspace.switchToAnnual();
        await workspace.annual.load();
        expect(api.annualReport).not.toHaveBeenCalled();
        expect(workspace.annual.getSnapshot().message).toContain(deadline);
      }
      workspace.switchToEod();
      vi.mocked(api.eodHistory).mockRejectedValueOnce(
        new TrialApiError("unavailable"),
      );
      await workspace.eod.load();
      expect(api.eodHistory).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );
  it("retires all sections on current Filings authentication loss and fences the late response", async () => {
    const { workspace, api } = fixture();
    await ready(workspace);
    workspace.add(result);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    workspace.switchToFilings();
    vi.mocked(api.recentFilings).mockRejectedValueOnce(
      new TrialApiError("unauthenticated"),
    );
    await workspace.filings.load();
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.filings.getSnapshot().selection).toBeNull();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(workspace.eod.getSnapshot().selection).toBeNull();
  });
});

describe("watchlist comparison note composition", () => {
  async function loadedPair() {
    const payload: MainWatchlistPayload = {
      ...empty,
      memberships: [
        { ...eodSelection.listing, note: "First stays exact" },
        { ...listingMembership(result), note: "Second café  東京 📈" },
        { ...listingMembership(second), note: "Hidden third stays exact" },
      ],
    };
    const value = fixture(payload);
    await ready(value.workspace);
    value.workspace.setView("watchlist");
    const rows = value.workspace.watchlistPrices.getSnapshot().rows;
    for (const [index, closes] of [
      [0, ["100", "110", "90"]],
      [1, ["100", "95", "120"]],
    ] as const) {
      const { note: _note, ...security } = payload.memberships[index]!;
      void _note;
      vi.mocked(value.api.eodHistory).mockResolvedValueOnce({
        ...eodResponse(),
        security,
        rows: closes.map((close, day) => ({
          date: `2026-09-${17 + day}`,
          close,
        })),
      });
      await value.workspace.loadWatchlistPrice(rows[index]!.handle);
      expect(
        value.workspace.watchlistPrices.getSnapshot().rows[index]!.history
          .response,
      ).not.toBeNull();
    }
    const prices = value.workspace.watchlistPrices.getSnapshot();
    let selection = createManagedWatchlistComparisonSelection();
    for (const [side, row] of [
      ["left", prices.rows[0]!],
      ["right", prices.rows[1]!],
    ] as const)
      selection = selectManagedWatchlistComparisonRow(
        selection,
        selection,
        prices,
        side,
        row,
      );
    selection = changeManagedWatchlistComparisonInterval(
      selection,
      selection,
      prices,
      "startDate",
      "2026-09-18",
    );
    return {
      ...value,
      payload,
      prices,
      selection,
      destination: prices.rows[1]!.listing,
    };
  }

  it("appends to one explicitly named latest note and saves the whole ordered draft only on request", async () => {
    const { workspace, api, saved, payload, prices, selection, destination } =
      await loadedPair();
    expect(
      workspace.getWatchlistComparisonNoteAction(selection, null).canAppend,
    ).toBe(false);
    expect(
      workspace.getWatchlistComparisonNoteAction(selection, destination),
    ).toEqual({ canAppend: true, reason: null });
    workspace.note(destination.listingId, "Latest café  東京 📈 text");
    workspace.move(destination.listingId, -1);
    const result = workspace.appendWatchlistComparisonToNote(
      selection,
      destination,
    );
    expect(result.appended).toBe(true);
    expect(result.message).toContain("DEMO (Class A, XNAS)");
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships.map((member) => member.listingId)).toEqual([
      destination.listingId,
      payload.memberships[0]!.listingId,
      payload.memberships[2]!.listingId,
    ]);
    expect(draft.memberships[0]!.note).toMatch(/^Latest café {2}東京 📈 text /);
    for (const text of [
      "2026-09-18",
      "2026-09-19",
      "110",
      "90",
      "95",
      "120",
      "-18.1818%",
      "+26.3158%",
      "Tiingo",
    ])
      expect(draft.memberships[0]!.note).toContain(text);
    expect(draft.memberships.slice(1)).toEqual([
      payload.memberships[0],
      payload.memberships[2],
    ]);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.search).toHaveBeenCalledTimes(1);
    expect(
      reconcileManagedWatchlistComparison(
        selection,
        workspace.watchlistPrices.getSnapshot(),
      ),
    ).toBe(selection);
    expect(
      workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
    ).toBe(prices.rows[1]!.history.response);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(saved().payload).toEqual(draft);
  });

  it.each([
    "missing",
    "third",
    "issuer",
    "security",
    "class",
    "exchange",
  ] as const)(
    "refuses a %s destination without changing either note",
    async (kind) => {
      const { workspace, selection, destination, payload } = await loadedPair();
      const candidate =
        kind === "missing"
          ? null
          : kind === "third"
            ? payload.memberships[2]!
            : {
                ...destination,
                ...(kind === "issuer" ? { issuerId: "retired-issuer" } : {}),
                ...(kind === "security"
                  ? { securityId: "retired-security" }
                  : {}),
                ...(kind === "class"
                  ? { shareClassName: "Retired class" }
                  : {}),
                ...(kind === "exchange" ? { exchangeMic: "XNYS" } : {}),
              };
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.getWatchlistComparisonNoteAction(selection, candidate)
          .canAppend,
      ).toBe(false);
      expect(
        workspace.appendWatchlistComparisonToNote(selection, candidate)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    },
  );

  it("enforces the complete Unicode note bound without normalizing existing raw text", async () => {
    const { workspace, selection, destination } = await loadedPair();
    workspace.note(destination.listingId, "");
    expect(
      workspace.appendWatchlistComparisonToNote(selection, destination)
        .appended,
    ).toBe(true);
    const excerpt =
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
    const remaining = 2_000 - [...excerpt].length - 1;
    expect(remaining).toBeGreaterThan(5);
    const exact = "📈".repeat(remaining - 4) + "  東京";
    workspace.note(destination.listingId, exact);
    expect(
      workspace.appendWatchlistComparisonToNote(selection, destination)
        .appended,
    ).toBe(true);
    const complete =
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
    expect([...complete]).toHaveLength(2_000);
    expect(complete).toBe(exact + " " + excerpt);
    workspace.note(destination.listingId, exact + "x");
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendWatchlistComparisonToNote(selection, destination)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.note(destination.listingId, "Invalid\nraw note");
    expect(
      workspace.appendWatchlistComparisonToNote(selection, destination)
        .appended,
    ).toBe(false);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toBe("Invalid\nraw note");
  });

  it.each(["failure", "cancel"] as const)(
    "refuses a refresh and preserves %s history with its qualification",
    async (outcome) => {
      const { workspace, api, selection, destination, prices } =
        await loadedPair();
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
      const pending = workspace.loadWatchlistPrice(prices.rows[0]!.handle);
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.appendWatchlistComparisonToNote(selection, destination)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      if (outcome === "cancel") {
        workspace.watchlistPrices.cancel();
        held.resolve({
          ...eodResponse(),
          rows: [{ date: "2026-09-19", close: "999" }],
        });
      } else held.reject(new TrialApiError("unavailable"));
      await pending;
      expect(
        workspace.appendWatchlistComparisonToNote(selection, destination)
          .appended,
      ).toBe(true);
      const note =
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
      expect(note).toContain("Retained previous history");
      expect(note).not.toContain("999");
      expect(
        workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
      ).toBe(prices.rows[0]!.history.response);
      expect(api.eodHistory).toHaveBeenCalledTimes(3);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("rejects a replaced equal-valued response and accepts its newly captured interval", async () => {
    const { workspace, api, selection, destination, prices } =
      await loadedPair();
    vi.mocked(api.eodHistory).mockResolvedValueOnce(
      structuredClone(prices.rows[0]!.history.response!),
    );
    await workspace.loadWatchlistPrice(prices.rows[0]!.handle);
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendWatchlistComparisonToNote(selection, destination)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    const current = reconcileManagedWatchlistComparison(
      selection,
      workspace.watchlistPrices.getSnapshot(),
    );
    expect(current).not.toBe(selection);
    expect(
      workspace.appendWatchlistComparisonToNote(current, destination).appended,
    ).toBe(true);
  });

  it.each([
    "view",
    "company",
    "catalog",
    "remove-readd",
    "retire",
    "conflict",
    "uncertain",
    "pending-save",
  ] as const)(
    "refuses stale comparison appends across %s",
    async (boundary) => {
      const { workspace, api, selection, destination, payload } =
        await loadedPair();
      let finish: (() => Promise<void>) | undefined;
      if (boundary === "view") workspace.setView("markets");
      if (boundary === "company") {
        workspace.openWatchlistEod(
          workspace.coordinator.getSnapshot().draft!.memberships[1]!,
        );
        expect(workspace.getSnapshot().research).not.toBeNull();
      }
      if (boundary === "catalog") {
        vi.mocked(api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await workspace.refreshCatalog();
      }
      if (boundary === "remove-readd") {
        workspace.remove(destination.listingId);
        workspace.coordinator.replaceDraft(payload);
      }
      if (boundary === "retire") workspace.coordinator.retire();
      if (boundary === "conflict" || boundary === "uncertain") {
        workspace.note(destination.listingId, "Boundary retains draft");
        vi.mocked(api.save).mockRejectedValueOnce(
          new TrialApiError(
            boundary === "conflict" ? "conflict" : "unavailable",
          ),
        );
        await workspace.coordinator.save();
      }
      if (boundary === "pending-save") {
        workspace.note(destination.listingId, "Pending retains draft");
        const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
        const pending = workspace.coordinator.save();
        finish = async () => {
          held.reject(new TrialApiError("unavailable"));
          await pending;
        };
      }
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.getWatchlistComparisonNoteAction(selection, destination)
          .canAppend,
      ).toBe(false);
      expect(
        workspace.appendWatchlistComparisonToNote(selection, destination)
          .appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      await finish?.();
    },
  );
});

describe("watchlist price workspace composition", () => {
  const initial = (): MainWatchlistPayload => ({
    ...empty,
    memberships: [
      { ...eodSelection.listing, note: "Original ZERO thesis" },
      { ...listingMembership(result), note: "Other company note" },
    ],
  });
  async function watchlistReady() {
    const value = fixture(initial());
    await ready(value.workspace);
    value.workspace.setView("watchlist");
    return value;
  }

  it("compares two loaded histories without reading the third or altering the draft", async () => {
    const payload = {
      ...initial(),
      memberships: [
        ...initial().memberships,
        { ...listingMembership(second), note: "Third stays unloaded" },
      ],
    };
    const { workspace, api } = fixture(payload);
    await ready(workspace);
    workspace.setView("watchlist");
    const initialRows = workspace.watchlistPrices.getSnapshot().rows;
    for (const [index, values] of [
      [0, ["100", "110", "90"]],
      [1, ["100", "95", "120"]],
    ] as const) {
      const { note, ...security } = payload.memberships[index]!;
      expect(note.length).toBeGreaterThan(0);
      vi.mocked(api.eodHistory).mockResolvedValueOnce({
        ...eodResponse(),
        security,
        rows: values.map((close, day) => ({
          date: `2026-09-${17 + day}`,
          close,
        })),
      });
      await workspace.loadWatchlistPrice(initialRows[index]!.handle);
    }
    const prices = workspace.watchlistPrices.getSnapshot();
    expect(prices.rows[2]!.history.response).toBeNull();
    const before = structuredClone(workspace.coordinator.getSnapshot().draft);
    let selection = createManagedWatchlistComparisonSelection();
    for (const [side, row] of [
      ["left", prices.rows[0]!],
      ["right", prices.rows[1]!],
    ] as const)
      selection = selectManagedWatchlistComparisonRow(
        selection,
        selection,
        prices,
        side,
        row,
      );
    const full = projectManagedWatchlistComparison(
      selection,
      prices,
    ).comparison;
    expect(full?.status).toBe("available");
    if (full?.status !== "available") throw new Error("Expected loaded pair");
    expect(full.rows.map((row) => row.change.changePercent)).toEqual([
      "-10.0000",
      "20.0000",
    ]);
    selection = changeManagedWatchlistComparisonInterval(
      selection,
      selection,
      prices,
      "endDate",
      "2026-09-18",
    );
    const first = projectManagedWatchlistComparison(
      selection,
      prices,
    ).comparison;
    expect(first?.status).toBe("available");
    if (first?.status !== "available")
      throw new Error("Expected first interval");
    expect(first.rows.map((row) => row.change.changePercent)).toEqual([
      "10.0000",
      "-5.0000",
    ]);
    expect(first.rows.map((row) => [row.firstClose, row.lastClose])).toEqual([
      ["100", "110"],
      ["100", "95"],
    ]);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.economicCalendar).not.toHaveBeenCalled();

    workspace.note(
      prices.rows[0]!.listing.listingId,
      "Unsaved café 東京 thesis",
    );
    workspace.move(prices.rows[0]!.listing.listingId, 1);
    const retained = workspace.watchlistPrices.getSnapshot();
    expect(reconcileManagedWatchlistComparison(selection, retained)).toBe(
      selection,
    );
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    const locked = workspace.watchlistPrices.getSnapshot();
    expect(locked.canRead).toBe(false);
    expect(reconcileManagedWatchlistComparison(selection, locked)).toBe(
      selection,
    );
    expect(
      projectManagedWatchlistComparison(selection, locked).comparison,
    ).toEqual(first);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
    await workspace.coordinator.load();
    workspace.coordinator.keepDraft();
    expect(
      reconcileManagedWatchlistComparison(
        selection,
        workspace.watchlistPrices.getSnapshot(),
      ),
    ).toBe(selection);
    await workspace.coordinator.save();
    expect(
      reconcileManagedWatchlistComparison(
        selection,
        workspace.watchlistPrices.getSnapshot(),
      ),
    ).toBe(selection);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toBe("Unsaved café 東京 thesis");

    workspace.setView("markets");
    const retired = workspace.watchlistPrices.getSnapshot();
    const cleared = reconcileManagedWatchlistComparison(selection, retired);
    expect(cleared.left).toBeNull();
    expect(cleared.right).toBeNull();
    workspace.setView("watchlist");
    expect(
      selectManagedWatchlistComparisonRow(
        cleared,
        selection,
        workspace.watchlistPrices.getSnapshot(),
        "left",
        prices.rows[0]!,
      ),
    ).toBe(cleared);
    expect(
      workspace.watchlistPrices
        .getSnapshot()
        .rows.every((row) => row.history.response === null),
    ).toBe(true);
    expect(api.eodHistory).toHaveBeenCalledTimes(2);
  });

  it("keeps price rows through note, order and Save copies, then hands off a checked retained history", async () => {
    const { workspace, api, saved } = await watchlistReady();
    const row = workspace.watchlistPrices.getSnapshot().rows[0]!;
    expect(api.eodHistory).not.toHaveBeenCalled();
    vi.mocked(api.eodHistory).mockResolvedValueOnce(eodResponse());
    await workspace.loadWatchlistPrice(row.handle);
    const loaded =
      workspace.watchlistPrices.getSnapshot().rows[0]!.history.response;
    workspace.note(row.listing.listingId, "Edited thesis remains exact");
    workspace.move(row.listing.listingId, 1);
    await workspace.coordinator.save();
    const currentRow = workspace.watchlistPrices.getSnapshot().rows[1]!;
    expect(currentRow.handle).toBe(row.handle);
    expect(currentRow.history.response).toBe(loaded);
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(true);
    expect(saved().payload.memberships.map((member) => member.note)).toEqual([
      "Other company note",
      "Edited thesis remains exact",
    ]);
    expect(api.eodHistory).toHaveBeenCalledTimes(1);
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
    const pending = workspace.loadWatchlistPrice(row.handle);
    const before = structuredClone(workspace.coordinator.getSnapshot().draft);
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    expect(vi.mocked(api.eodHistory).mock.calls[1]![1].aborted).toBe(true);
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: loaded,
      responseOrigin: "watchlist",
      showingPrevious: true,
    });
    expect(workspace.eod.getSnapshot().response).not.toBe(loaded);
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(false);
    const companyPacket = {
      ...eodResponse(),
      rows: [{ date: "2026-09-19", close: "105" }],
    };
    vi.mocked(api.eodHistory).mockResolvedValueOnce(companyPacket);
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: companyPacket,
      responseOrigin: "company",
    });
    workspace.closeResearch();
    expect(
      workspace.watchlistPrices.getSnapshot().rows[1]!.history.response,
    ).toBe(loaded);
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(workspace.coordinator.getSnapshot().phase).not.toBe("retired");
    expect(api.eodHistory).toHaveBeenCalledTimes(3);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it("reconciles recovery choices before publishing, preserving only matching row lifetimes", async () => {
    const { workspace, api } = await watchlistReady();
    const row = workspace.watchlistPrices.getSnapshot().rows[0]!;
    vi.mocked(api.eodHistory).mockResolvedValueOnce(eodResponse());
    await workspace.loadWatchlistPrice(row.handle);
    const loaded =
      workspace.watchlistPrices.getSnapshot().rows[0]!.history.response;
    workspace.note(row.listing.listingId, "Unsaved recovery draft");
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(false);
    await workspace.loadWatchlistPrice(row.handle);
    expect(api.eodHistory).toHaveBeenCalledTimes(1);
    await workspace.coordinator.load();
    const draft = workspace.coordinator.getSnapshot().draft;
    workspace.coordinator.keepDraft();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(workspace.watchlistPrices.getSnapshot().canRead).toBe(true);
    expect(
      workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
    ).toBe(loaded);
    workspace.coordinator.useSaved();
    expect(workspace.watchlistPrices.getSnapshot().rows[0]!.handle).toBe(
      row.handle,
    );
    expect(
      workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
    ).toBe(loaded);
    vi.mocked(api.load).mockResolvedValueOnce({
      version: 4,
      payload: { ...initial(), memberships: [initial().memberships[1]!] },
    });
    await workspace.coordinator.load();
    workspace.coordinator.useSaved();
    expect(
      workspace.watchlistPrices
        .getSnapshot()
        .rows.map((entry) => entry.listing.listingId),
    ).toEqual(["listing-one"]);
    workspace.coordinator.replaceDraft(initial());
    const replacement = workspace.watchlistPrices.getSnapshot().rows[0]!;
    expect(replacement.handle).not.toBe(row.handle);
    expect(replacement.history.response).toBeNull();
    await workspace.loadWatchlistPrice(row.handle);
    expect(api.eodHistory).toHaveBeenCalledTimes(1);
  });

  it.each(["annual", "route", "invalid route", "top-level exit"] as const)(
    "cancels watchlist work on %s and rejects its late completion",
    async (destination) => {
      const { workspace, api } = await watchlistReady();
      const row = workspace.watchlistPrices.getSnapshot().rows[0]!;
      vi.mocked(api.eodHistory).mockResolvedValueOnce(eodResponse());
      await workspace.loadWatchlistPrice(row.handle);
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
      const pending = workspace.loadWatchlistPrice(row.handle);
      const cancel = workspace.watchlistPrices.getSnapshot().pending!.cancel;
      if (destination === "annual")
        workspace.openWatchlistAnnual(
          workspace.coordinator.getSnapshot().draft!.memberships[0]!,
        );
      else if (destination === "route")
        await workspace.setCompanyRoute({
          kind: "company",
          listingId: "listing-one",
          section: "eod",
        });
      else if (destination === "invalid route")
        await workspace.setCompanyRoute(null);
      else workspace.setView("discover");
      expect(vi.mocked(api.eodHistory).mock.calls[1]![1].aborted).toBe(true);
      held.resolve({
        ...eodResponse(),
        rows: [{ date: "2026-09-19", close: "999" }],
      });
      await pending;
      cancel();
      workspace.closeResearch();
      if (destination === "top-level exit") {
        expect(workspace.watchlistPrices.getSnapshot().rows).toEqual([]);
        workspace.setView("watchlist");
        expect(
          workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
        ).toBeNull();
        expect(
          workspace.watchlistPrices.getSnapshot().rows[0]!.handle,
        ).not.toBe(row.handle);
      } else
        expect(
          workspace.watchlistPrices.getSnapshot().rows[0]!.history.response,
        ).toEqual(eodResponse());
      expect(workspace.coordinator.getSnapshot().draft).toEqual(initial());
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("invalidates every watchlist price row when one row reports a catalog change", async () => {
    const { workspace, api } = await watchlistReady();
    const rows = workspace.watchlistPrices.getSnapshot().rows;
    expect(rows).toHaveLength(2);
    vi.mocked(api.eodHistory).mockRejectedValueOnce(
      new ManagedCatalogChangedError(),
    );
    await workspace.loadWatchlistPrice(rows[0]!.handle);
    expect(workspace.getSnapshot().snapshot).toBeNull();
    expect(workspace.watchlistPrices.getSnapshot().rows).toEqual([]);
    await workspace.loadWatchlistPrice(rows[1]!.handle);
    expect(api.eodHistory).toHaveBeenCalledTimes(1);
    expect(workspace.coordinator.getSnapshot().draft).toEqual(initial());
    await workspace.refreshCatalog();
    expect(workspace.watchlistPrices.getSnapshot().rows[0]!.handle).not.toBe(
      rows[0]!.handle,
    );
  });

  it("retires all price rows on current authentication loss without retaining the draft", async () => {
    const { workspace, api } = await watchlistReady();
    const row = workspace.watchlistPrices.getSnapshot().rows[0]!;
    vi.mocked(api.eodHistory).mockRejectedValueOnce(
      new TrialApiError("unauthenticated"),
    );
    await workspace.loadWatchlistPrice(row.handle);
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(workspace.watchlistPrices.getSnapshot()).toMatchObject({
      active: false,
      rows: [],
      pending: null,
      canRead: false,
    });
    await workspace.loadWatchlistPrice(row.handle);
    expect(api.eodHistory).toHaveBeenCalledTimes(1);
  });
});

describe("watchlist Annual comparison workspace ownership", () => {
  const initial = (): MainWatchlistPayload => ({
    ...empty,
    memberships: [
      { ...eodSelection.listing, note: "  Original ZERO thesis 😀  " },
      { ...listingMembership(result), note: "Other issuer thesis" },
    ],
  });
  async function comparisonFixture() {
    const setup = fixture(initial());
    await ready(setup.workspace);
    setup.workspace.setView("watchlist");
    const comparison = setup.workspace.annualComparison;
    const left = comparison.getSnapshot().memberships[0]!;
    const right = comparison.getSnapshot().memberships[1]!;
    comparison.select("left", comparison.getSnapshot(), left);
    comparison.select("right", comparison.getSnapshot(), right);
    return { ...setup, comparison, left, right };
  }

  it("retains both explicit choices and the report across note/reorder/Save without extra reads", async () => {
    const { workspace, api, comparison, left, right } =
      await comparisonFixture();
    vi.mocked(api.annualReport).mockResolvedValueOnce(await annualResponse());
    const beforeRead = workspace.coordinator.getSnapshot();
    await comparison.load("left", left);
    expect(workspace.coordinator.getSnapshot()).toBe(beforeRead);
    const report = comparison.getSnapshot().left.report;
    workspace.note(left.listing.listingId, "Exact changed Café 😀");
    workspace.move(left.listing.listingId, 1);
    const fullDraft = workspace.coordinator.getSnapshot().draft;
    await workspace.coordinator.save();
    expect(comparison.getSnapshot().left.report).toBe(report);
    expect(comparison.getSnapshot().left.selected).toBe(left);
    expect(comparison.getSnapshot().right.selected).toBe(right);
    expect(comparison.getSnapshot().memberships).toEqual([right, left]);
    expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(fullDraft);
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
  });

  it("reconciles Keep draft and Use saved against the complete draft even while hidden", async () => {
    const { workspace, api, comparison, left, right } =
      await comparisonFixture();
    vi.mocked(api.annualReport).mockResolvedValueOnce(await annualResponse());
    await comparison.load("left", left);
    const report = comparison.getSnapshot().left.report;
    workspace.note(left.listing.listingId, "Unsaved recovery research");
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    expect(comparison.getSnapshot().canRead).toBe(false);
    await comparison.load("right", right);
    expect(api.annualReport).toHaveBeenCalledOnce();
    await workspace.coordinator.load();
    workspace.coordinator.keepDraft();
    expect(comparison.getSnapshot().left.report).toBe(report);
    expect(comparison.getSnapshot().canRead).toBe(true);
    workspace.setView("discover");
    vi.mocked(api.load).mockResolvedValueOnce({
      version: 4,
      payload: { ...initial(), memberships: [initial().memberships[1]!] },
    });
    await workspace.coordinator.load();
    workspace.coordinator.useSaved();
    expect(comparison.getSnapshot().left.selected).toBeNull();
    expect(comparison.getSnapshot().right.selected).toBe(right);
    workspace.coordinator.replaceDraft(initial());
    workspace.setView("watchlist");
    expect(comparison.getSnapshot().left.selected).toBeNull();
    expect(comparison.getSnapshot().memberships[0]!.handle).not.toBe(
      left.handle,
    );
    await comparison.load("left", left);
    expect(api.annualReport).toHaveBeenCalledOnce();
  });

  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "cancels pending comparison reads when coordinator enters %s",
    async (boundary) => {
      const { workspace, api, comparison, left } = await comparisonFixture();
      workspace.note(left.listing.listingId, "Draft remains exact");
      const annual = deferred<never>();
      vi.mocked(api.annualReport).mockReturnValueOnce(annual.promise);
      const reading = comparison.load("left", left);
      const held = deferred<never>();
      let changing: Promise<void> | null = null;
      if (boundary === "loading") {
        vi.mocked(api.load).mockReturnValueOnce(held.promise);
        changing = workspace.coordinator.load();
      } else if (boundary === "saving") {
        vi.mocked(api.save).mockReturnValueOnce(held.promise);
        changing = workspace.coordinator.save();
      } else {
        vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError(boundary));
        await workspace.coordinator.save();
      }
      expect(vi.mocked(api.annualReport).mock.calls[0]![1].aborted).toBe(true);
      expect(comparison.getSnapshot()).toMatchObject({
        canRead: false,
        pending: null,
      });
      await comparison.load("left", left);
      expect(api.annualReport).toHaveBeenCalledOnce();
      annual.reject(new TrialApiError("unauthenticated"));
      await reading;
      expect(workspace.coordinator.getSnapshot().phase).not.toBe("retired");
      expect(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
      ).toBe("Draft remains exact");
      if (changing) {
        held.reject(new TrialApiError("unavailable"));
        await changing;
      }
    },
  );

  it("cancels pending work on company navigation but retains accepted reports on Back", async () => {
    const { workspace, api, comparison, left } = await comparisonFixture();
    const packet = await annualResponse();
    vi.mocked(api.annualReport).mockResolvedValueOnce(packet);
    await comparison.load("left", left);
    const held = deferred<never>();
    vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
    const refresh = comparison.load("left", left);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    expect(comparison.getSnapshot().active).toBe(false);
    expect(vi.mocked(api.annualReport).mock.calls[1]![1].aborted).toBe(true);
    held.reject(new TrialApiError("unauthenticated"));
    await refresh;
    workspace.closeResearch();
    expect(comparison.getSnapshot()).toMatchObject({
      active: true,
      left: {
        selected: left,
        report: { response: packet, showingPrevious: true },
      },
    });
    expect(api.annualReport).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("shares a comparison SEC deadline with the existing company Annual and Filings owners", async () => {
    const { workspace, api, comparison, left } = await comparisonFixture();
    const deadline = new Date(Date.now() + 120000).toISOString();
    vi.mocked(api.annualReport).mockRejectedValueOnce(
      new ManagedSecCooldownError(deadline),
    );
    await comparison.load("left", left);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    workspace.switchToFilings();
    await workspace.filings.load();
    expect(workspace.annual.getSnapshot().message).toContain(deadline);
    expect(workspace.filings.getSnapshot().message).toContain(deadline);
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.recentFilings).not.toHaveBeenCalled();
  });

  it("invalidates catalog-dependent owners and never rewrites the draft after comparison catalog refusal", async () => {
    const { workspace, api, comparison, left } = await comparisonFixture();
    const before = workspace.coordinator.getSnapshot().draft;
    vi.mocked(api.annualReport).mockRejectedValueOnce(
      new ManagedCatalogChangedError(),
    );
    await comparison.load("left", left);
    expect(workspace.getSnapshot().snapshot).toBeNull();
    expect(comparison.getSnapshot().memberships).toEqual([]);
    expect(comparison.getSnapshot().left.selected).toBeNull();
    expect(workspace.watchlistPrices.getSnapshot().rows).toEqual([]);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    await workspace.refreshCatalog();
    expect(comparison.getSnapshot().memberships[0]!.handle).not.toBe(
      left.handle,
    );
  });

  it("clears both comparison sides and the draft on current Annual authentication loss", async () => {
    const { workspace, api, comparison, left } = await comparisonFixture();
    vi.mocked(api.annualReport).mockRejectedValueOnce(
      new TrialApiError("unauthenticated"),
    );
    await comparison.load("left", left);
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
    expect(comparison.getSnapshot()).toMatchObject({
      active: false,
      memberships: [],
      left: { selected: null },
      right: { selected: null },
    });
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe("Annual comparison appended to one current draft note", () => {
  async function noteFixture(group: AnnualComparisonNoteGroup = "cash") {
    const setup = fixture({
      ...empty,
      memberships: [
        annualComparisonMemberships.left,
        {
          ...annualComparisonMemberships.right,
          note: "Fiscal company research",
        },
      ],
    });
    await ready(setup.workspace);
    setup.workspace.setView("watchlist");
    const comparison = setup.workspace.annualComparison;
    const [left, right] = comparison.getSnapshot().memberships;
    comparison.select("left", comparison.getSnapshot(), left!);
    comparison.select("right", comparison.getSnapshot(), right!);
    vi.mocked(setup.api.annualReport)
      .mockResolvedValueOnce(
        await annualComparisonResponse(
          "left",
          group === "operating"
            ? {
                rows: annualComparisonRows("left").filter(
                  (row) => row.metric === "revenue",
                ),
                operatingRows: annualComparisonOperatingRows("left"),
              }
            : {},
        ),
      )
      .mockResolvedValueOnce(
        await annualComparisonResponse(
          "right",
          group === "operating"
            ? {
                rows: annualComparisonRows("right").filter(
                  (row) => row.metric === "revenue",
                ),
                operatingRows: annualComparisonOperatingRows("right"),
              }
            : {},
        ),
      );
    await comparison.load("left", left!);
    await comparison.load("right", right!);
    const capture = (): AnnualComparisonNoteCapture => {
      const state = comparison.getSnapshot();
      const side = (key: "left" | "right") => ({
        member: state[key].selected!,
        response: state[key].report.response!,
        selectedBasis:
          group === "operating"
            ? key === "left"
              ? "Revenues"
              : "SalesRevenueNet"
            : projectAnnualComparison(
                state[key].report.response,
                state[key].report.response === null
                  ? null
                  : viewOf(state[key].report.response),
              ).selectedBasis,
        showingPrevious: state[key].report.showingPrevious,
      });
      return { group, left: side("left"), right: side("right") };
    };
    return { ...setup, comparison, left: left!, right: right!, capture };
  }

  it.each([
    { group: "income", side: "right" },
    { group: "cash", side: "right" },
    { group: "liquidity", side: "left" },
    { group: "liquidity", side: "right" },
    { group: "operating", side: "left" },
    { group: "operating", side: "right" },
  ] as const)(
    "appends $group to the latest $side member, preserves raw prose/order and explicitly saves the full draft",
    async ({ group, side }) => {
      const { workspace, api, session, saved, left, right, capture } =
        await noteFixture(group);
      const selected = capture();
      const evidence = getAnnualComparisonNoteEvidence(selected);
      const destination = side === "left" ? left : right;
      const destinationIndex = side === "right" ? 0 : 1;
      expect(evidence.excerpt).not.toBeNull();
      expect(
        workspace.getAnnualComparisonNoteAction(selected, destination)
          .canAppend,
      ).toBe(true);
      const raw = "  Cafe\u0301 changed after rendering 😀  ";
      workspace.note(destination.listing.listingId, raw);
      workspace.move(right.listing.listingId, -1);
      const before = workspace.coordinator.getSnapshot().draft!;
      expect(
        workspace.appendAnnualComparisonToNote(selected, destination).appended,
      ).toBe(true);
      const after = workspace.coordinator.getSnapshot().draft!;
      expect(after).toEqual({
        ...before,
        memberships: before.memberships.map((member, index) =>
          index === destinationIndex
            ? { ...member, note: raw + " " + evidence.excerpt }
            : member,
        ),
      });
      expect(after.memberships[1]!.listingId).toBe(left.listing.listingId);
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      await workspace.coordinator.save();
      expect(api.save).toHaveBeenCalledOnce();
      expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(
        saved().payload,
      );
      expect(saved().payload.memberships[destinationIndex]!.note).toBe(
        normalizeWatchlistNote(raw + " " + evidence.excerpt),
      );
      const reopened = new ManagedWorkspace(api, session, undefined, {
        researchCoverage: inventedManagedResearchCoverage,
      });
      await reopened.coordinator.load();
      expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
    },
  );

  describe.each(["cash", "liquidity", "operating"] as const)(
    "%s admission",
    (group) => {
      it("refuses duplicates without changing the draft and permits an explicit remove and re-add", async () => {
        const { workspace, api, left, capture } = await noteFixture(group);
        const selected = capture();
        expect(
          workspace.appendAnnualComparisonToNote(selected, left).appended,
        ).toBe(true);
        const after = workspace.coordinator.getSnapshot().draft;
        expect(workspace.appendAnnualComparisonToNote(selected, left)).toEqual({
          appended: false,
          message:
            "This exact Annual comparison reference is already in the note draft.",
        });
        expect(workspace.coordinator.getSnapshot().draft).toBe(after);
        workspace.note(left.listing.listingId, "Original prose restored");
        expect(
          workspace.appendAnnualComparisonToNote(selected, left).appended,
        ).toBe(true);
        expect(api.annualReport).toHaveBeenCalledTimes(2);
        expect(api.save).not.toHaveBeenCalled();
      });

      it.each([
        "exact code-point limit",
        "one over limit",
        "control character",
      ] as const)(
        "checks the entire latest note at %s without trimming or truncating the draft",
        async (boundary) => {
          const { workspace, api, left, capture } = await noteFixture(group);
          const selected = capture();
          const excerpt = getAnnualComparisonNoteEvidence(selected).excerpt!;
          expect(excerpt).not.toBeNull();
          const remaining = 2000 - [...excerpt].length - 1;
          expect(remaining).toBeGreaterThan(0);
          const raw =
            boundary === "control character"
              ? "Untouched\u0001raw"
              : "😀".repeat(
                  remaining + (boundary === "one over limit" ? 1 : 0),
                );
          if (boundary !== "control character")
            expect([...(raw + " " + excerpt).normalize("NFC")].length).toBe(
              boundary === "exact code-point limit" ? 2000 : 2001,
            );
          workspace.note(left.listing.listingId, raw);
          const before = workspace.coordinator.getSnapshot().draft;
          const accepted = boundary === "exact code-point limit";
          expect(
            workspace.getAnnualComparisonNoteAction(selected, left).canAppend,
          ).toBe(accepted);
          expect(
            workspace.appendAnnualComparisonToNote(selected, left).appended,
          ).toBe(accepted);
          if (accepted)
            expect(
              workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
            ).toBe(raw + " " + excerpt);
          else expect(workspace.coordinator.getSnapshot().draft).toBe(before);
          expect(api.save).not.toHaveBeenCalled();
        },
      );

      it.each(["empty", "copied handle", "opposite stale member"] as const)(
        "refuses the %s destination without falling back to another note",
        async (kind) => {
          const { workspace, left, right, comparison, capture } =
            await noteFixture(group);
          const selected = capture();
          let destination = kind === "empty" ? null : { ...left };
          if (kind === "opposite stale member") {
            destination = right;
            comparison.select("right", comparison.getSnapshot(), null);
            comparison.select("right", comparison.getSnapshot(), right);
          }
          const before = workspace.coordinator.getSnapshot().draft;
          expect(
            workspace.appendAnnualComparisonToNote(selected, destination)
              .appended,
          ).toBe(false);
          expect(workspace.coordinator.getSnapshot().draft).toBe(before);
        },
      );

      it("fences a pending refresh and stale retained qualifier; Cancel permits the newly captured original report", async () => {
        const { workspace, api, comparison, left, capture } =
          await noteFixture(group);
        const original = capture();
        const held =
          deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
        vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
        const refreshing = comparison.load("left", left);
        const before = workspace.coordinator.getSnapshot().draft;
        expect(
          workspace.appendAnnualComparisonToNote(original, left).appended,
        ).toBe(false);
        comparison.getSnapshot().pending!.cancel();
        expect(
          workspace.appendAnnualComparisonToNote(original, left).appended,
        ).toBe(false);
        const retained = capture();
        expect(retained.left.response).toBe(original.left.response);
        expect(retained.left.showingPrevious).toBe(true);
        expect(
          workspace.getAnnualComparisonNoteAction(retained, left).canAppend,
        ).toBe(true);
        held.resolve(
          await annualComparisonResponse("left", { mode: "multiple-bases" }),
        );
        await refreshing;
        expect(comparison.getSnapshot().left.report.response).toBe(
          original.left.response,
        );
        expect(workspace.coordinator.getSnapshot().draft).toBe(before);
        expect(
          workspace.appendAnnualComparisonToNote(retained, left).appended,
        ).toBe(true);
        expect(
          workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
        ).toContain(getAnnualComparisonNoteEvidence(retained).excerpt!);
        expect(api.annualReport).toHaveBeenCalledTimes(3);
        expect(api.save).not.toHaveBeenCalled();
      });

      it("refuses a replaced response even when the exact pair and values remain the same", async () => {
        const { workspace, api, comparison, left, capture } =
          await noteFixture(group);
        const previous = capture();
        vi.mocked(api.annualReport).mockResolvedValueOnce(
          await annualComparisonResponse(
            "left",
            group === "operating"
              ? { operatingRows: annualComparisonOperatingRows("left") }
              : {},
          ),
        );
        await comparison.load("left", left);
        const before = workspace.coordinator.getSnapshot().draft;
        expect(
          workspace.appendAnnualComparisonToNote(previous, left).appended,
        ).toBe(false);
        expect(workspace.coordinator.getSnapshot().draft).toBe(before);
        expect(
          workspace.getAnnualComparisonNoteAction(capture(), left).canAppend,
        ).toBe(true);
      });

      it.each([
        "discover",
        "research",
        "company route",
        "catalog changed",
        "member removed",
        "retired",
      ] as const)("refuses captured evidence after %s", async (boundary) => {
        const { workspace, comparison, left, capture } =
          await noteFixture(group);
        const selected = capture();
        if (boundary === "discover") workspace.setView("discover");
        else if (boundary === "research")
          workspace.openWatchlistAnnual(
            workspace.coordinator.getSnapshot().draft!.memberships[0]!,
          );
        else if (boundary === "company route")
          await workspace.setCompanyRoute({
            kind: "company",
            listingId: "listing-one",
            section: "annual",
          });
        else if (boundary === "catalog changed")
          workspace.coordinator.replaceDraft({
            ...workspace.coordinator.getSnapshot().draft!,
            snapshotSha256: nextDigest,
          });
        else if (boundary === "member removed")
          workspace.remove(left.listing.listingId);
        else
          workspace.coordinator.readError(new TrialApiError("unauthenticated"));
        const before = workspace.coordinator.getSnapshot().draft;
        expect(
          workspace.appendAnnualComparisonToNote(selected, left).appended,
        ).toBe(false);
        expect(workspace.coordinator.getSnapshot().draft).toBe(before);
        if (boundary === "retired")
          expect(comparison.getSnapshot().left.report.response).toBeNull();
      });

      it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
        "refuses an otherwise valid note during coordinator %s",
        async (boundary) => {
          const { workspace, api, left, capture } = await noteFixture(group);
          const selected = capture();
          workspace.note(
            left.listing.listingId,
            "Draft changed before coordinator work",
          );
          const held = deferred<never>();
          let operation: Promise<void> | null = null;
          if (boundary === "loading") {
            vi.mocked(api.load).mockReturnValueOnce(held.promise);
            operation = workspace.coordinator.load();
          } else if (boundary === "saving") {
            vi.mocked(api.save).mockReturnValueOnce(held.promise);
            operation = workspace.coordinator.save();
          } else {
            vi.mocked(api.save).mockRejectedValueOnce(
              new TrialApiError(boundary),
            );
            await workspace.coordinator.save();
          }
          const before = workspace.coordinator.getSnapshot().draft;
          expect(
            workspace.getAnnualComparisonNoteAction(selected, left).canAppend,
          ).toBe(false);
          expect(
            workspace.appendAnnualComparisonToNote(selected, left).appended,
          ).toBe(false);
          expect(workspace.coordinator.getSnapshot().draft).toBe(before);
          if (operation) {
            held.reject(new TrialApiError("unavailable"));
            await operation;
          }
          expect(api.annualReport).toHaveBeenCalledTimes(2);
        },
      );
    },
  );
});

describe("Annual cash generation appended to the shared note", () => {
  const zero: PersonalSecurityMasterSearchResultDto = {
    ...eodSelection.listing,
    cik: "0000000001",
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  };
  async function cashNoteFixture(available = true) {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(second), note: "Keep the other share class" },
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
    const response = await cashResponse(
      available
        ? [
            cashRow("operating_cash_flow", "-250.125"),
            cashRow("ppe_purchases", "0"),
          ]
        : [],
    );
    vi.mocked(api.annualReport).mockResolvedValue(response);
    await ready(workspace);
    workspace.openDiscoveryAnnual(zero);
    await workspace.annual.load();
    const selection = workspace.getSnapshot().research!.selection;
    const append = () =>
      workspace.appendAnnualCashToResearchNote(selection, response);
    return { ...setup, selection, response, append };
  }

  it("uses current raw prose, preserves other members and requires explicit whole-list save before reload", async () => {
    const { workspace, api, session, selection, response, append, saved } =
      await cashNoteFixture();
    expect(workspace.getAnnualCashNoteAction(selection, response)).toEqual({
      canAppend: true,
      reason: null,
    });
    const prose = "  Cafe\u0301 thesis revised after rendering 😀  ";
    workspace.noteResearch(selection, prose);
    const before = workspace.coordinator.getSnapshot().draft!;
    const excerpt = annualCashNoteExcerpt(response, false)!;
    expect(excerpt).not.toBeNull();
    expect(append()).toEqual({
      appended: true,
      message:
        "Cash generation added to the note draft. Review and save all changes in My Watchlist.",
    });
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft).toEqual({
      ...before,
      memberships: [
        before.memberships[0],
        { ...before.memberships[1], note: prose + " " + excerpt },
      ],
    });
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    workspace.switchToEod();
    workspace.closeResearch();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships[1]?.note).toBe(
      normalizeWatchlistNote(prose + " " + excerpt),
    );
    const reopened = new ManagedWorkspace(api, session, undefined, {
      researchCoverage: inventedManagedResearchCoverage,
    });
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(saved().payload);
  });

  it("refuses the exact excerpt twice and permits an explicit remove and re-add", async () => {
    const { workspace, selection, response, append, api } =
      await cashNoteFixture();
    expect(append().appended).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(append()).toEqual({
      appended: false,
      message:
        "This exact cash-generation reference is already in the note draft.",
    });
    expect(
      workspace.getAnnualCashNoteAction(selection, response).canAppend,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.noteResearch(selection, "Edited thesis");
    expect(append().appended).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).toBe("Edited thesis " + annualCashNoteExcerpt(response, false));
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).toHaveBeenCalledOnce();
  });

  it.each([
    "copied selection",
    "copied response",
    "reopened visit",
    "other listing",
    "closed visit",
    "Price section",
    "replacement response",
    "catalog change",
    "retirement",
  ])(
    "rejects a stale callback after %s without changing the draft or requesting data",
    async (boundary) => {
      const setup = await cashNoteFixture();
      const { workspace, api, response } = setup;
      let { selection } = setup;
      let captured = response;
      if (boundary === "copied selection") selection = { ...selection };
      else if (boundary === "copied response") captured = { ...response };
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
          structuredClone(response),
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
        workspace.getAnnualCashNoteAction(selection, captured).canAppend,
      ).toBe(false);
      expect(
        workspace.appendAnnualCashToResearchNote(selection, captured).appended,
      ).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.annualReport).toHaveBeenCalledTimes(reads);
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("blocks during refresh, qualifies the retained report after Cancel and ignores a late completion", async () => {
    const { workspace, api, selection, response, append } =
      await cashNoteFixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
    const loading = workspace.annual.load();
    const before = workspace.coordinator.getSnapshot().draft;
    expect(append()).toEqual({
      appended: false,
      message: "Wait for the Annual report request to finish or cancel it.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.annual.cancel();
    expect(append().appended).toBe(true);
    const appended = workspace.coordinator.getSnapshot().draft;
    expect(appended?.memberships[1]?.note).toBe(
      "Original thesis " + annualCashNoteExcerpt(response, true),
    );
    expect(annualCashNoteExcerpt(response, true)).not.toBe(
      annualCashNoteExcerpt(response, false),
    );
    held.resolve(
      await cashResponse(
        [cashRow("operating_cash_flow", "999"), cashRow("ppe_purchases", "12")],
        "2026-09-21T00:00:00.000Z",
      ),
    );
    await loading;
    expect(workspace.annual.getSnapshot().response).toBe(response);
    expect(workspace.coordinator.getSnapshot().draft).toBe(appended);
    expect(
      workspace.getAnnualCashNoteAction(selection, response).canAppend,
    ).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("keeps an unavailable cash section from adding an income-only report", async () => {
    const { workspace, selection, response, append, api } =
      await cashNoteFixture(false);
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.getAnnualCashNoteAction(selection, response).canAppend,
    ).toBe(false);
    expect(append().appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["missing member", "changed identity", "stale draft catalog"])(
    "preserves the %s boundary without adding a member",
    async (boundary) => {
      const { workspace, append, api } = await cashNoteFixture();
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
                  ? { ...member, shareClassId: "changed-class" }
                  : member,
              ),
      });
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "preserves the %s coordinator boundary",
    async (boundary) => {
      const { workspace, api, append } = await cashNoteFixture();
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
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).toHaveBeenCalledTimes(saves);
      if (pending) {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
    },
  );

  it.each(["😀", "e\u0301"])(
    "accepts 2,000 normalized code points with %s but refuses overflow without truncation",
    async (unit) => {
      const { workspace, selection, response, append, api } =
        await cashNoteFixture();
      const excerpt = annualCashNoteExcerpt(response, false)!;
      expect(excerpt).not.toBeNull();
      const room = 2000 - [...excerpt].length - 1;
      workspace.noteResearch(selection, unit.repeat(room + 1));
      const tooLong = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(tooLong);
      workspace.noteResearch(selection, unit.repeat(room));
      expect(append().appended).toBe(true);
      const note =
        workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
      expect(note).toBe(unit.repeat(room) + " " + excerpt);
      expect([...normalizeWatchlistNote(note)!]).toHaveLength(2000);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["private\nline", "invisible\u200btext"])(
    "preserves an invalid latest raw note instead of appending",
    async (note) => {
      const { workspace, selection, response, append, api } =
        await cashNoteFixture();
      expect(
        workspace.getAnnualCashNoteAction(selection, response).canAppend,
      ).toBe(true);
      workspace.noteResearch(selection, note);
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );
});

describe("loaded Annual comparison report visits", () => {
  async function reportFixture(operating = false) {
    const setup = fixture({
      ...empty,
      memberships: [
        annualComparisonMemberships.left,
        {
          ...annualComparisonMemberships.right,
          note: "Fiscal company research",
        },
      ],
    });
    await ready(setup.workspace);
    setup.workspace.setView("watchlist");
    const model = setup.workspace.annualComparison;
    for (const [side, index] of [
      ["left", 0],
      ["right", 1],
    ] as const) {
      const member = model.getSnapshot().memberships[index]!;
      model.select(side, model.getSnapshot(), member);
      vi.mocked(setup.api.annualReport).mockResolvedValueOnce(
        await annualComparisonResponse(
          side,
          operating
            ? {
                rows: annualComparisonRows(side).filter(
                  (row) => row.metric === "revenue",
                ),
                operatingRows: annualComparisonOperatingRows(side),
              }
            : {},
        ),
      );
      await model.load(side, member);
    }
    const capture = (
      side: "left" | "right",
    ): ManagedAnnualComparisonReportCapture => {
      const column = model.getSnapshot()[side];
      return {
        side,
        member: column.selected!,
        response: column.report.response!,
      };
    };
    return { ...setup, model, capture };
  }

  async function checked(workspace: ManagedWorkspace) {
    await vi.waitFor(() =>
      expect(workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
  }

  it.each(["left", "right"] as const)(
    "carries the %s operating packet without net income into a full report and returns to the original pair",
    async (side) => {
      const { workspace, model, capture, api } = await reportFixture(true);
      const original = capture(side);
      const pair = model.getSnapshot();
      const draft = workspace.coordinator.getSnapshot().draft;
      expect(
        viewOf(original.response).income.resolution.currentTargetEligible,
      ).toBe(false);
      expect(
        viewOf(original.response).operatingResults.resolution.operatingIncome,
      ).toMatchObject({
        status: "available",
        value: side === "left" ? "-250.125" : "125.25",
        startDate: side === "left" ? "2025-01-01" : "2024-07-01",
        endDate: side === "left" ? "2025-12-31" : "2025-06-30",
      });
      workspace.openAnnualComparisonReport(original);
      await checked(workspace);
      expect(workspace.annual.getSnapshot().response).toEqual(
        original.response,
      );
      expect(workspace.annual.getSnapshot().view!.operatingResults).toEqual(
        viewOf(original.response).operatingResults,
      );
      workspace.closeResearch();
      for (const key of ["left", "right"] as const)
        expect(model.getSnapshot()[key].report.response).toBe(
          pair[key].report.response,
        );
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      for (const read of [
        api.eodHistory,
        api.recentFilings,
        api.resolve,
        api.save,
      ])
        expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(["left", "right"] as const)(
    "opens the %s original packet, shares the current draft and returns without another read",
    async (side) => {
      const { workspace, model, capture, api, saved } = await reportFixture();
      const original = capture(side);
      const pair = model.getSnapshot();
      workspace.note(
        original.member.listing.listingId,
        "Latest draft before opening Café",
      );
      const before = workspace.coordinator.getSnapshot().draft!;
      workspace.openAnnualComparisonReport(original);
      expect(workspace.getSnapshot().research).toMatchObject({
        section: "annual",
        selection: {
          origin: "watchlist",
          cik: null,
          listing: original.member.listing,
        },
      });
      expect(workspace.annual.getSnapshot().checkingSeed).toBe(true);
      await checked(workspace);
      expect(workspace.annual.getSnapshot()).toMatchObject({
        response: original.response,
        responseOrigin: "watchlist-comparison",
        showingPrevious: false,
        error: false,
      });
      expect(workspace.annual.getSnapshot().response).not.toBe(
        original.response,
      );
      const selection = workspace.getSnapshot().research!.selection;
      expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
        "Latest draft before opening Café",
      );
      workspace.noteResearch(selection, "Thesis updated from full Annual");
      workspace.switchToEod();
      workspace.switchToAnnual();
      expect(workspace.annual.getSnapshot().response).toEqual(
        original.response,
      );
      const after = workspace.coordinator.getSnapshot().draft!;
      expect(after.memberships.map((member) => member.listingId)).toEqual(
        before.memberships.map((member) => member.listingId),
      );
      expect(
        after.memberships.filter(
          (member) => member.listingId !== selection.listing.listingId,
        ),
      ).toEqual(
        before.memberships.filter(
          (member) => member.listingId !== selection.listing.listingId,
        ),
      );
      workspace.closeResearch();
      expect(workspace.getSnapshot().view).toBe("watchlist");
      for (const key of ["left", "right"] as const) {
        expect(model.getSnapshot()[key].selected).toBe(pair[key].selected);
        expect(model.getSnapshot()[key].report.response).toBe(
          pair[key].report.response,
        );
      }
      expect(workspace.coordinator.getSnapshot().draft).toBe(after);
      expect(api.save).not.toHaveBeenCalled();
      await workspace.coordinator.save();
      expect(saved()).toEqual({ version: 2, payload: after });
      await workspace.coordinator.load();
      expect(workspace.coordinator.getSnapshot().draft).toEqual(after);
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
    },
  );

  it.each(["price-cancel", "seed-publication"] as const)(
    "rechecks membership after a synchronous %s notification",
    async (boundary) => {
      const { workspace, capture, api } = await reportFixture();
      const original = capture("left");
      const held = deferred<never>();
      let pending: Promise<void> | null = null;
      let triggered = false;
      let unsubscribe: () => void;
      if (boundary === "price-cancel") {
        vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
        const row = workspace.watchlistPrices
          .getSnapshot()
          .rows.find(
            (item) =>
              item.listing.listingId === original.member.listing.listingId,
          )!;
        pending = workspace.loadWatchlistPrice(row.handle);
        unsubscribe = workspace.watchlistPrices.subscribe(() => {
          if (!triggered) {
            triggered = true;
            workspace.remove(original.member.listing.listingId);
          }
        });
      } else {
        unsubscribe = workspace.annual.subscribe(() => {
          if (!triggered && workspace.annual.getSnapshot().checkingSeed) {
            triggered = true;
            workspace.remove(original.member.listing.listingId);
          }
        });
      }
      workspace.openAnnualComparisonReport(original);
      unsubscribe();
      expect(triggered).toBe(true);
      expect(workspace.getSnapshot().research).toBeNull();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.annual.getSnapshot().checkingSeed).toBe(false);
      if (pending) {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["clear", "inner-close", "seed-publication"] as const)(
    "keeps a replacement visit opened during %s",
    async (boundary) => {
      const { workspace, capture, api } = await reportFixture();
      let replacement = false;
      let emptyPublications = 0;
      const unsubscribe = workspace.annual.subscribe(() => {
        if (workspace.annual.getSnapshot().selection === null)
          emptyPublications++;
        if (
          !replacement &&
          (boundary === "clear" ||
            (boundary === "inner-close" && emptyPublications === 2) ||
            (boundary === "seed-publication" &&
              workspace.annual.getSnapshot().checkingSeed))
        ) {
          replacement = true;
          workspace.openWatchlistEod(
            workspace.coordinator.getSnapshot().draft!.memberships[1]!,
          );
        }
      });
      workspace.openAnnualComparisonReport(capture("left"));
      unsubscribe();
      expect(replacement).toBe(true);
      expect(workspace.getSnapshot().research).toMatchObject({
        section: "eod",
        selection: {
          listing: { listingId: annualComparisonMemberships.right.listingId },
        },
      });
      expect(workspace.eod.getSnapshot().selection?.listing.listingId).toBe(
        annualComparisonMemberships.right.listingId,
      );
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.eodHistory).not.toHaveBeenCalled();
    },
  );

  it("refreshes only the company visit and returns to the original checked comparison", async () => {
    const { workspace, model, capture, api } = await reportFixture();
    const original = capture("right");
    workspace.openAnnualComparisonReport(original);
    await checked(workspace);
    const refreshed = await annualComparisonResponse("right", {
      cutoffAt: "2026-10-02T12:00:00.000Z",
    });
    vi.mocked(api.annualReport).mockResolvedValueOnce(refreshed);
    await workspace.annual.load();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: refreshed,
      responseOrigin: "request",
      showingPrevious: false,
    });
    workspace.closeResearch();
    expect(model.getSnapshot().right.report.response).toBe(original.response);
    expect(api.annualReport).toHaveBeenCalledTimes(3);
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["left", "right"] as const)(
    "retires a pending %s comparison refresh before opening, and fences its late session error",
    async (pendingSide) => {
      const { workspace, model, capture, api } = await reportFixture();
      const original = capture("left");
      const held = deferred<never>();
      vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
      const pending = model.load(
        pendingSide,
        model.getSnapshot()[pendingSide].selected!,
      );
      const signal = vi.mocked(api.annualReport).mock.calls.at(-1)![1];
      workspace.openAnnualComparisonReport(original);
      expect(signal.aborted).toBe(true);
      await checked(workspace);
      expect(workspace.annual.getSnapshot().showingPrevious).toBe(
        pendingSide === "left",
      );
      const accepted = workspace.annual.getSnapshot().response;
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace.getSnapshot().research?.section).toBe("annual");
      expect(workspace.annual.getSnapshot().response).toBe(accepted);
      expect(workspace.coordinator.getSnapshot().draft).not.toBeNull();
      expect(api.annualReport).toHaveBeenCalledTimes(3);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("allows reading accepted evidence during a save conflict while keeping notes read-only", async () => {
    const { workspace, capture, api } = await reportFixture();
    const original = capture("left");
    workspace.note(
      original.member.listing.listingId,
      "Draft preserved through conflict",
    );
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    const before = workspace.coordinator.getSnapshot().draft;
    expect(workspace.coordinator.getSnapshot().conflict).toBe(true);
    workspace.openAnnualComparisonReport(original);
    await checked(workspace);
    expect(workspace.annual.getSnapshot().response).toEqual(original.response);
    const selection = workspace.getSnapshot().research!.selection;
    expect(workspace.getResearchWatchlist(selection).canEdit).toBe(false);
    workspace.noteResearch(selection, "Must not replace conflicted draft");
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).toHaveBeenCalledOnce();
    expect(api.annualReport).toHaveBeenCalledTimes(2);
  });

  it.each(["navigation", "view", "removed", "identity", "retired"] as const)(
    "refuses an old opener after %s changes",
    async (boundary) => {
      const { workspace, capture, api } = await reportFixture();
      const original = capture("left");
      if (boundary === "navigation") workspace.setNavigationBlocked(true);
      if (boundary === "view") workspace.setView("markets");
      if (boundary === "removed")
        workspace.remove(original.member.listing.listingId);
      if (boundary === "identity") {
        const draft = workspace.coordinator.getSnapshot().draft!;
        workspace.coordinator.replaceDraft({
          ...draft,
          memberships: draft.memberships.map((member) =>
            member.listingId === original.member.listing.listingId
              ? { ...member, shareClassId: "replacement-class" }
              : member,
          ),
        });
      }
      if (boundary === "retired") workspace.coordinator.retire();
      const before = workspace.coordinator.getSnapshot().draft;
      workspace.openAnnualComparisonReport(original);
      expect(workspace.getSnapshot().research).toBeNull();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["close", "switch", "remove", "retire"] as const)(
    "does not restore a local report check after %s",
    async (boundary) => {
      const { workspace, capture, api } = await reportFixture();
      const original = capture("left");
      workspace.openAnnualComparisonReport(original);
      expect(workspace.annual.getSnapshot().checkingSeed).toBe(true);
      if (boundary === "close") workspace.closeResearch();
      if (boundary === "switch") workspace.switchToEod();
      if (boundary === "remove")
        workspace.remove(original.member.listing.listingId);
      if (boundary === "retire") workspace.coordinator.retire();
      const settled = workspace.annual.getSnapshot();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(workspace.annual.getSnapshot()).toBe(settled);
      expect(settled.response).toBeNull();
      expect(settled.checkingSeed).toBe(false);
      expect(workspace.getSnapshot().research?.section ?? null).toBe(
        boundary === "switch" ? "eod" : null,
      );
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
    },
  );
});

describe("selected watchlist filings handoff", () => {
  async function selectedFixture() {
    const setup = fixture({
      ...empty,
      memberships: [
        { ...listingMembership(result), note: "Selected thesis Café 😀" },
        { ...listingMembership(second), note: "Other class thesis" },
      ],
    });
    await ready(setup.workspace);
    const { workspace, api } = setup;
    workspace.setView("watchlist");
    workspace.selectWatchlistFilingsMember(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const model = workspace.watchlistFilings;
    const member = model.getSnapshot().selected!;
    expect(api.recentFilings).not.toHaveBeenCalled();
    const selection = model.getSnapshot().filings.selection!;
    vi.mocked(api.recentFilings).mockResolvedValue(
      filingsResponse(2, "available", selection),
    );
    await model.load(member);
    const response = model.getSnapshot().filings.response!;
    return { ...setup, model, member, response, capture: { member, response } };
  }

  it("opens the checked packet without another read, appends to the latest note and saves the complete draft only explicitly", async () => {
    const { workspace, api, model, capture, saved } = await selectedFixture();
    workspace.note(result.listingId, "Latest thesis Café 😀");
    workspace.move(result.listingId, 1);
    const before = workspace.coordinator.getSnapshot().draft!;
    workspace.openWatchlistFilings(capture);
    expect(workspace.getSnapshot().research?.section).toBe("filings");
    const selection = workspace.getSnapshot().research!.selection;
    const response = workspace.filings.getSnapshot().response!;
    expect(response).toEqual(capture.response);
    expect(response).not.toBe(capture.response);
    expect(workspace.filings.getSnapshot().responseOrigin).toBe("watchlist");
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(model.getSnapshot().active).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    const row = response.issuer.filings[0]!;
    const excerpt = filingReferenceNoteExcerpt(response, row, false)!;
    expect(
      workspace.appendFilingReferenceToResearchNote(selection, response, row)
        .appended,
    ).toBe(true);
    expect(workspace.coordinator.getSnapshot().draft).toEqual({
      ...before,
      memberships: [
        before.memberships[0],
        { ...before.memberships[1], note: "Latest thesis Café 😀 " + excerpt },
      ],
    });
    expect(
      workspace.appendFilingReferenceToResearchNote(selection, response, row)
        .appended,
    ).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.recentFilings).toHaveBeenCalledOnce();
    workspace.closeResearch();
    expect(model.getSnapshot().filings.response).toBe(capture.response);
    expect(model.getSnapshot().selected).toBe(capture.member);
    await workspace.coordinator.save();
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(saved().payload);
    expect(saved().payload.memberships[1]!.note).toBe(
      "Latest thesis Café 😀 " + excerpt,
    );
    expect(model.getSnapshot().filings.response).toBe(capture.response);
    expect(api.save).toHaveBeenCalledOnce();
    expect(api.recentFilings).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("keeps company refresh independent and clears the selected packet on a top-level departure", async () => {
    const { workspace, api, model, capture } = await selectedFixture();
    workspace.openWatchlistFilings(capture);
    const baseline = workspace.filings.getSnapshot().response;
    expect(workspace.filings.getSnapshot().refreshComparison).toBeNull();
    const selection = workspace.getSnapshot().research!.selection;
    vi.mocked(api.recentFilings).mockResolvedValueOnce(
      filingsResponse(0, "available", selection),
    );
    await workspace.filings.load();
    expect(
      workspace.filings.getSnapshot().response!.issuer.filings,
    ).toHaveLength(0);
    expect(workspace.filings.getSnapshot().responseOrigin).toBe("request");
    const comparison = workspace.filings.getSnapshot().refreshComparison!;
    expect(comparison.previous).toBe(baseline);
    expect(comparison.current).toBe(workspace.filings.getSnapshot().response);
    expect(comparison.newAccessions).toEqual([]);
    expect(model.getSnapshot().filings.refreshComparison).toBeNull();
    workspace.closeResearch();
    expect(workspace.filings.getSnapshot().refreshComparison).toBeNull();
    expect(model.getSnapshot().filings.response).toBe(capture.response);
    workspace.setView("markets");
    expect(model.getSnapshot().filings.response).toBeNull();
    workspace.setView("watchlist");
    workspace.selectWatchlistFilingsMember(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    expect(model.getSnapshot().filings.response).toBeNull();
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
  });

  it("permits viewing retained evidence during a save conflict while source reads and note writes stay blocked", async () => {
    const { workspace, api, model, capture } = await selectedFixture();
    workspace.note(result.listingId, "Conflicted draft");
    vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await workspace.coordinator.save();
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(model.getSnapshot().canRead).toBe(false);
    await model.load(capture.member);
    workspace.openWatchlistFilings(capture);
    const selection = workspace.getSnapshot().research!.selection;
    expect(workspace.filings.getSnapshot().response).toEqual(capture.response);
    workspace.noteResearch(selection, "Must not replace draft");
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.recentFilings).toHaveBeenCalledOnce();
  });

  it.each([
    "selection",
    "removed",
    "identity",
    "navigation",
    "view",
    "retired",
  ] as const)("refuses a stale opener after %s", async (boundary) => {
    const { workspace, api, model, capture } = await selectedFixture();
    if (boundary === "selection")
      workspace.selectWatchlistFilingsMember(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!,
      );
    if (boundary === "removed") workspace.remove(result.listingId);
    if (boundary === "identity") {
      const draft = workspace.coordinator.getSnapshot().draft!;
      workspace.coordinator.replaceDraft({
        ...draft,
        memberships: draft.memberships.map((m) =>
          m.listingId === result.listingId
            ? { ...m, shareClassId: "new-class" }
            : m,
        ),
      });
    }
    if (boundary === "navigation") workspace.setNavigationBlocked(true);
    if (boundary === "view") workspace.setView("markets");
    if (boundary === "retired") workspace.coordinator.retire();
    const draft = workspace.coordinator.getSnapshot().draft;
    workspace.openWatchlistFilings(capture);
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.filings.getSnapshot().selection).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(model.canAdmitFilings(capture)).toBe(false);
    expect(api.recentFilings).toHaveBeenCalledOnce();
  });

  it.each(["new visit", "retire", "remove"] as const)(
    "does not publish an older handoff when company model notification triggers %s",
    async (boundary) => {
      const { workspace, api, capture } = await selectedFixture();
      let ran = false;
      const stop = workspace.filings.subscribe(() => {
        if (ran || !workspace.filings.getSnapshot().selection) return;
        ran = true;
        if (boundary === "new visit")
          workspace.openWatchlistAnnual(
            workspace.coordinator.getSnapshot().draft!.memberships[1]!,
          );
        if (boundary === "retire") workspace.coordinator.retire();
        if (boundary === "remove") workspace.remove(result.listingId);
      });
      workspace.openWatchlistFilings(capture);
      stop();
      expect(ran).toBe(true);
      expect(workspace.getSnapshot().research?.section ?? null).toBe(
        boundary === "new visit" ? "annual" : null,
      );
      expect(workspace.filings.getSnapshot().selection).toBeNull();
      if (boundary === "new visit")
        expect(
          workspace.getSnapshot().research!.selection.listing.listingId,
        ).toBe(second.listingId);
      expect(api.recentFilings).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );
});

describe("workspace persisted follow-up research", () => {
  const zero: PersonalSecurityMasterSearchResultDto = {
    ...eodSelection.listing,
    cik: eodSelection.cik!,
    matchKind: "current_symbol_exact",
    matchedValue: "ZERO",
  };
  const entryId = "00000000-0000-4000-8000-000000000001";
  const active: ManagedWorkspace[] = [];
  afterEach(() => {
    for (const workspace of active.splice(0)) workspace.sessionOwner.dispose();
  });
  function identity(selected: PersonalSecurityMasterSearchResultDto) {
    const { note, ...listing } = listingMembership(selected);
    expect(note).toBe("");
    return listing;
  }
  function entry(): ResearchFollowup {
    const listing = identity(zero);
    return {
      id: entryId,
      catalogSnapshotSha256: digest,
      listing,
      check: "Review the dated capacity disclosure · Café 東京 📈",
      dueOn: "2026-12-31",
      status: "open",
      completedOn: null,
      result: "",
    };
  }
  function persistence(
    initial: ResearchFollowupsPayload = {
      schemaVersion: 1,
      entries: [entry()],
    },
  ) {
    let stored: ManagedResearchFollowupsDto = {
      version: initial.entries.length ? 1 : 0,
      payload: structuredClone(initial),
    };
    return {
      bind(api: ManagedApi) {
        vi.mocked(api.loadFollowups).mockImplementation(() =>
          Promise.resolve(structuredClone(stored)),
        );
        vi.mocked(api.saveFollowups).mockImplementation((command) => {
          if (command.expectedVersion !== stored.version)
            return Promise.reject(new TrialApiError("conflict"));
          stored = {
            version: command.expectedVersion + 1,
            payload: structuredClone(command.payload),
          };
          return Promise.resolve({
            ...structuredClone(stored),
            replayed: false,
          });
        });
      },
      saved: () => structuredClone(stored),
    };
  }
  async function followupFixture(store = persistence()) {
    const f = fixture();
    active.push(f.workspace);
    store.bind(f.api);
    vi.mocked(f.api.search).mockResolvedValue({
      snapshot,
      results: [zero, second],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "INVENTED",
    });
    vi.mocked(f.api.resolve).mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => {
          const found = [zero, second].find(
            (value) => value.listingId === listingId,
          );
          return { listingId, listing: found ? identity(found) : null };
        }),
      }),
    );
    vi.mocked(f.api.eodHistory).mockImplementation((request) =>
      Promise.resolve(eodResponse(request.range)),
    );
    vi.mocked(f.api.annualReport).mockImplementation(() => annualResponse());
    vi.mocked(f.api.recentFilings).mockResolvedValue(filingsResponse());
    await ready(f.workspace);
    f.workspace.setView("followups");
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    await f.workspace.followups.coordinator.load();
    const current = () =>
      f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
    return { ...f, store, current };
  }
  function noSources(api: ManagedApi) {
    for (const call of [
      api.eodHistory,
      api.annualReport,
      api.recentFilings,
      api.monetaryAnnouncements,
      api.economicCalendar,
    ])
      expect(call).not.toHaveBeenCalled();
  }
  async function prepared(f: Awaited<ReturnType<typeof followupFixture>>) {
    const capture = await f.workspace.prepareFollowupResearch(f.current());
    expect(capture).not.toBeNull();
    if (!capture) throw new Error("Expected the current follow-up capture");
    return capture;
  }

  it("persists an unsaved actual member independently, researches after fresh load without that member, and completes explicitly", async () => {
    const store = persistence({ schemaVersion: 1, entries: [] });
    const first = await followupFixture(store);
    first.workspace.add(zero);
    first.workspace.note(
      zero.listingId,
      "Unsent watchlist thesis · Café 東京 📈",
    );
    const member =
      first.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    first.workspace.followups.add({ ...member }, "2026-12-31");
    expect(
      first.workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toEqual([]);
    first.workspace.followups.add(member, "2026-12-31");
    first.workspace.followups.edit(
      first.current(),
      "check",
      "Review the dated filing · Café 東京 📈",
    );
    const created = first.current();
    expect(created.listing).not.toHaveProperty("note");
    expect(created.listing).toMatchObject(eodSelection.listing);
    expect(first.workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(first.api.saveFollowups).not.toHaveBeenCalled();
    await first.workspace.followups.coordinator.save();
    expect(first.api.saveFollowups).toHaveBeenCalledOnce();
    expect(first.api.save).not.toHaveBeenCalled();
    expect(first.saved().payload.memberships).toEqual([]);
    expect(store.saved().payload.entries).toEqual([created]);
    noSources(first.api);
    expect(first.api.resolve).not.toHaveBeenCalled();
    first.workspace.sessionOwner.retire();

    const fresh = await followupFixture(store);
    expect(fresh.session).not.toBe(first.session);
    expect(fresh.workspace).not.toBe(first.workspace);
    expect(fresh.current()).toEqual(created);
    expect(
      fresh.workspace.coordinator.getSnapshot().draft!.memberships,
    ).toEqual([]);
    fresh.workspace.add(second);
    fresh.workspace.note(
      second.listingId,
      "Another unsaved share-class thesis · 東京 📈",
    );
    fresh.workspace.followups.edit(
      fresh.current(),
      "result",
      "Unsent authored observation · Café",
    );
    fresh.workspace.followups.setFilter("all");
    fresh.workspace.followups.select(fresh.current().id);
    const watchlistDraft = fresh.workspace.coordinator.getSnapshot().draft;
    const followupDraft =
      fresh.workspace.followups.coordinator.getSnapshot().draft;
    const capture = await prepared(fresh);
    expect(fresh.api.resolve).toHaveBeenCalledExactlyOnceWith(
      { snapshotSha256: digest, listingIds: [zero.listingId] },
      expect.any(AbortSignal),
    );
    noSources(fresh.api);
    fresh.workspace.openFollowupResearch(capture);
    expect(fresh.workspace.getSnapshot().research?.selection).toMatchObject({
      origin: "followups",
      cik: null,
      listing: capture.entry.listing,
    });
    expect(fresh.workspace.eod.getSnapshot().selection).not.toBe(
      capture.selection,
    );
    expect(fresh.workspace.eod.getSnapshot().selection).toEqual(
      capture.selection,
    );
    noSources(fresh.api);
    fresh.workspace.setNavigationBlocked(true);
    await fresh.workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "annual",
    });
    expect(fresh.workspace.getSnapshot().companyRoute).toMatchObject({
      status: "open",
      section: "annual",
    });
    expect(fresh.workspace.getSnapshot().research?.selection.origin).toBe(
      "followups",
    );
    expect(fresh.api.resolve).toHaveBeenCalledOnce();
    noSources(fresh.api);
    for (const section of ["annual", "eod", "filings"] as const) {
      const visit = fresh.workspace.getSnapshot().research!;
      await fresh.workspace.requestResearchSource(visit, section);
      expect(fresh.workspace[section].getSnapshot().response).not.toBeNull();
    }
    expect(fresh.api.annualReport).toHaveBeenCalledOnce();
    expect(fresh.api.eodHistory).toHaveBeenCalledOnce();
    expect(fresh.api.recentFilings).toHaveBeenCalledOnce();
    expect(fresh.api.resolve).toHaveBeenCalledOnce();
    expect(fresh.api.save).not.toHaveBeenCalled();
    expect(fresh.api.saveFollowups).not.toHaveBeenCalled();
    fresh.workspace.closeResearch();
    fresh.workspace.setNavigationBlocked(false);
    expect(fresh.workspace.getSnapshot()).toMatchObject({
      view: "followups",
      research: null,
      companyRoute: null,
    });
    expect(fresh.workspace.followups.getSnapshot()).toMatchObject({
      filter: "all",
      selectedId: created.id,
    });
    expect(fresh.workspace.coordinator.getSnapshot().draft).toBe(
      watchlistDraft,
    );
    expect(fresh.workspace.followups.coordinator.getSnapshot().draft).toBe(
      followupDraft,
    );
    expect(fresh.workspace.sessionOwner.getSnapshot()).toMatchObject({
      watchlist: { dirty: true },
      followups: { dirty: true },
      needsLeaveReview: true,
    });
    fresh.workspace.followups.complete(
      fresh.current(),
      new Date("2026-10-15T23:59:59.000Z"),
    );
    expect(fresh.api.saveFollowups).not.toHaveBeenCalled();
    await fresh.workspace.followups.coordinator.save();
    expect(fresh.api.saveFollowups).toHaveBeenCalledOnce();
    expect(fresh.api.save).not.toHaveBeenCalled();
    const completed = store.saved();
    expect(completed).toMatchObject({
      version: 2,
      payload: {
        entries: [
          {
            id: created.id,
            status: "completed",
            completedOn: "2026-10-15",
            result: "Unsent authored observation · Café",
          },
        ],
      },
    });
    fresh.workspace.sessionOwner.retire();
    const last = await followupFixture(store);
    expect(last.current()).toEqual(completed.payload.entries[0]);
    expect(last.workspace.coordinator.getSnapshot().draft!.memberships).toEqual(
      [],
    );
    noSources(last.api);
    expect(last.api.resolve).not.toHaveBeenCalled();
    expect(last.api.save).not.toHaveBeenCalled();
  });

  it.each([
    "draft",
    "entry",
    "removed",
    "catalog",
    "navigation",
    "view",
    "session",
  ] as const)(
    "discards a pending follow-up resolve after %s changes",
    async (boundary) => {
      const f = await followupFixture();
      const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
      vi.mocked(f.api.resolve).mockReturnValueOnce(held.promise);
      const oldEntry = f.current();
      const pending = f.workspace.prepareFollowupResearch(oldEntry);
      expect(f.workspace.getSnapshot().followupOpening).toBe(true);
      const watchlist = f.workspace.coordinator.getSnapshot().draft;
      if (boundary === "draft")
        f.workspace.followups.coordinator.replaceDraft({
          ...f.workspace.followups.coordinator.getSnapshot().draft!,
          entries: [{ ...oldEntry }],
        });
      if (boundary === "entry")
        f.workspace.followups.edit(
          oldEntry,
          "check",
          "Intervening authored check",
        );
      if (boundary === "removed") f.workspace.followups.remove(oldEntry);
      if (boundary === "catalog") {
        vi.mocked(f.api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: nextDigest },
        });
        await f.workspace.refreshCatalog();
      }
      if (boundary === "navigation") f.workspace.setNavigationBlocked(true);
      if (boundary === "view") f.workspace.setView("discover");
      if (boundary === "session") f.workspace.sessionOwner.retire();
      if (["navigation", "view", "session"].includes(boundary))
        expect(vi.mocked(f.api.resolve).mock.calls[0]![1].aborted).toBe(true);
      held.resolve({
        snapshotSha256: digest,
        results: [{ listingId: zero.listingId, listing: oldEntry.listing }],
      });
      expect(await pending).toBeNull();
      expect(f.workspace.getSnapshot()).toMatchObject({
        research: null,
        followupOpening: false,
      });
      expect(f.api.resolve).toHaveBeenCalledOnce();
      expect(f.api.save).not.toHaveBeenCalled();
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
      if (boundary === "session") {
        expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
        expect(
          f.workspace.followups.coordinator.getSnapshot().draft,
        ).toBeNull();
      } else
        expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
      noSources(f.api);
    },
  );

  it("does not replace a newer direct company route with a late follow-up resolution", async () => {
    const f = await followupFixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    vi.mocked(f.api.resolve).mockReturnValueOnce(held.promise);
    const pending = f.workspace.prepareFollowupResearch(f.current());
    const signal = vi.mocked(f.api.resolve).mock.calls[0]![1];
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "annual",
    });
    const newer = f.workspace.getSnapshot().research;
    expect(newer?.selection.origin).toBe("route");
    expect(signal.aborted).toBe(true);
    held.resolve({
      snapshotSha256: digest,
      results: [{ listingId: zero.listingId, listing: f.current().listing }],
    });
    expect(await pending).toBeNull();
    expect(f.workspace.getSnapshot().research).toBe(newer);
    expect(f.api.resolve).toHaveBeenCalledTimes(2);
    noSources(f.api);
  });

  it.each(["view", "remove", "blocked", "retire"] as const)(
    "refuses an old prepared capture after %s",
    async (boundary) => {
      const f = await followupFixture();
      const capture = await prepared(f);
      if (boundary === "view") f.workspace.setView("watchlist");
      if (boundary === "remove") f.workspace.followups.remove(f.current());
      if (boundary === "blocked") f.workspace.setNavigationBlocked(true);
      if (boundary === "retire") f.workspace.sessionOwner.retire();
      f.workspace.openFollowupResearch(capture);
      expect(f.workspace.getSnapshot().research).toBeNull();
      for (const model of [
        f.workspace.eod,
        f.workspace.annual,
        f.workspace.filings,
      ])
        expect(model.getSnapshot().selection).toBeNull();
      expect(f.api.resolve).toHaveBeenCalledOnce();
      noSources(f.api);
    },
  );

  it.each(["remove", "rebind"] as const)(
    "closes an active visit after follow-up %s and fences a late source response",
    async (boundary) => {
      const f = await followupFixture();
      const capture = await prepared(f);
      f.workspace.openFollowupResearch(capture);
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(f.api.eodHistory).mockReturnValueOnce(held.promise);
      const visit = f.workspace.getSnapshot().research!;
      const pending = f.workspace.requestResearchSource(visit, "eod");
      const watchlist = f.workspace.coordinator.getSnapshot().draft;
      expect(f.api.eodHistory).toHaveBeenCalledOnce();
      if (boundary === "remove") f.workspace.followups.remove(f.current());
      else
        f.workspace.followups.coordinator.replaceDraft({
          schemaVersion: 1,
          entries: [
            {
              ...f.current(),
              listing: {
                ...f.current().listing,
                shareClassId: "replacement-class",
              },
            },
          ],
        });
      expect(vi.mocked(f.api.eodHistory).mock.calls[0]![1].aborted).toBe(true);
      expect(f.workspace.getSnapshot().research).toBeNull();
      held.resolve(eodResponse());
      await pending;
      expect(f.workspace.eod.getSnapshot().response).toBeNull();
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
      expect(f.api.save).not.toHaveBeenCalled();
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
    },
  );

  it("keeps an active exact-company visit through authored edits and follow-up Save copies", async () => {
    const f = await followupFixture();
    const capture = await prepared(f);
    f.workspace.openFollowupResearch(capture);
    const visit = f.workspace.getSnapshot().research;
    f.workspace.followups.edit(
      f.current(),
      "result",
      "Authored update retains exact identity",
    );
    f.workspace.followups.edit(f.current(), "dueOn", "2027-01-01");
    expect(f.workspace.getSnapshot().research).toBe(visit);
    await f.workspace.followups.coordinator.save();
    expect(f.workspace.getSnapshot().research).toBe(visit);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "filings",
    });
    expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
      "followups",
    );
    expect(f.workspace.filings.getSnapshot().selection).toEqual(
      capture.selection,
    );
    expect(f.api.resolve).toHaveBeenCalledOnce();
    noSources(f.api);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  });

  it.each(["opening", "capture"] as const)(
    "refuses reentrant publication during %s",
    async (phase) => {
      const f = await followupFixture();
      let changed = false;
      const stop = f.workspace.subscribe(() => {
        const state = f.workspace.getSnapshot();
        if (
          changed ||
          !state.followupOpening ||
          (phase === "capture" && state.message !== "")
        )
          return;
        changed = true;
        f.workspace.followups.edit(
          f.current(),
          "check",
          "Changed by a synchronous observer",
        );
      });
      const capture = await f.workspace.prepareFollowupResearch(f.current());
      stop();
      expect(changed).toBe(true);
      expect(capture).toBeNull();
      expect(f.api.resolve).toHaveBeenCalledTimes(phase === "opening" ? 0 : 1);
      expect(f.workspace.getSnapshot()).toMatchObject({
        research: null,
        followupOpening: false,
      });
      noSources(f.api);
    },
  );

  it.each(["remove", "navigate", "retire"] as const)(
    "does not publish a stale visit when model-open notification triggers %s",
    async (boundary) => {
      const f = await followupFixture();
      const capture = await prepared(f);
      let changed = false;
      const stop = f.workspace.eod.subscribe(() => {
        if (changed || !f.workspace.eod.getSnapshot().selection) return;
        changed = true;
        if (boundary === "remove") f.workspace.followups.remove(f.current());
        if (boundary === "navigate") f.workspace.setView("markets");
        if (boundary === "retire") f.workspace.sessionOwner.retire();
      });
      f.workspace.openFollowupResearch(capture);
      stop();
      expect(changed).toBe(true);
      expect(f.workspace.getSnapshot().research).toBeNull();
      expect(f.workspace.eod.getSnapshot().selection).toBeNull();
      noSources(f.api);
    },
  );

  it.each(["missing", "same-ticker-rebind", "different-digest"] as const)(
    "refuses %s catalog resolution without substituting company identity",
    async (boundary) => {
      const f = await followupFixture();
      vi.mocked(f.api.resolve).mockResolvedValueOnce({
        snapshotSha256: boundary === "different-digest" ? nextDigest : digest,
        results: [
          {
            listingId: zero.listingId,
            listing:
              boundary === "missing"
                ? null
                : {
                    ...f.current().listing,
                    ...(boundary === "same-ticker-rebind"
                      ? { shareClassId: "other-class" }
                      : {}),
                  },
          },
        ],
      });
      expect(await f.workspace.prepareFollowupResearch(f.current())).toBeNull();
      expect(f.workspace.getSnapshot().research).toBeNull();
      expect(f.api.resolve).toHaveBeenCalledOnce();
      noSources(f.api);
    },
  );

  it("routes both coordinator sign-outs through one original SDK call and fences pending follow-up research", async () => {
    const f = await followupFixture();
    f.workspace.add(second);
    const held = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    vi.mocked(f.api.resolve).mockReturnValueOnce(held.promise);
    const resolving = f.workspace.prepareFollowupResearch(f.current());
    const listing = f.current().listing;
    const signOut = deferred<void>();
    vi.mocked(f.session.signOut).mockReturnValueOnce(signOut.promise);
    const watchlistSignOut = f.workspace.coordinator.signOut();
    const followupSignOut = f.workspace.followups.coordinator.signOut();
    const aggregateSignOut = f.workspace.sessionOwner.signOut();
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    await Promise.resolve();
    expect(f.session.signOut).toHaveBeenCalledOnce();
    held.resolve({
      snapshotSha256: digest,
      results: [{ listingId: zero.listingId, listing }],
    });
    expect(await resolving).toBeNull();
    signOut.resolve();
    await Promise.all([watchlistSignOut, followupSignOut, aggregateSignOut]);
    expect(f.workspace.sessionOwner.getSnapshot().phase).toBe("retired");
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.session.signOut).toHaveBeenCalledOnce();
    noSources(f.api);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it.each(["eod", "annual", "filings"] as const)(
    "keeps follow-up %s actions and Cancel bound to the exact visit",
    async (section) => {
      const f = await followupFixture();
      f.workspace.openFollowupResearch(await prepared(f));
      const oldVisit = f.workspace.getSnapshot().research!;
      f.workspace.closeResearch();
      f.workspace.openFollowupResearch(await prepared(f));
      const newVisit = f.workspace.getSnapshot().research!;
      expect(newVisit).not.toBe(oldVisit);
      expect(newVisit.selection).toEqual(oldVisit.selection);
      await f.workspace.requestResearchSource(oldVisit, section);
      noSources(f.api);
      const methods = {
        eod: "eodHistory",
        annual: "annualReport",
        filings: "recentFilings",
      } as const;
      const read = f.api[methods[section]];
      const held = deferred<never>();
      vi.mocked(read).mockReturnValueOnce(held.promise);
      const pending = f.workspace.requestResearchSource(newVisit, section);
      const activeVisit = f.workspace.getSnapshot().research!;
      expect(read).toHaveBeenCalledOnce();
      const signal = vi.mocked(read).mock.calls[0]![1];
      f.workspace.cancelResearchSource(oldVisit, section);
      expect(signal.aborted).toBe(false);
      f.workspace.cancelResearchSource(activeVisit, section);
      expect(signal.aborted).toBe(true);
      held.reject(new TrialApiError("unavailable"));
      await pending;
      expect(f.workspace.getSnapshot().research).toBe(activeVisit);
      expect(f.api.resolve).toHaveBeenCalledTimes(2);
      expect(f.api.save).not.toHaveBeenCalled();
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
    },
  );

  it("retires both drafts on a follow-up resolve authentication failure and ignores a late pending save", async () => {
    const f = await followupFixture();
    f.workspace.add(second);
    f.workspace.followups.edit(
      f.current(),
      "result",
      "Pending authored result",
    );
    const held = deferred<Awaited<ReturnType<ManagedApi["saveFollowups"]>>>();
    vi.mocked(f.api.saveFollowups).mockReturnValueOnce(held.promise);
    const saving = f.workspace.followups.coordinator.save();
    const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
    vi.mocked(f.api.resolve).mockRejectedValueOnce(
      new TrialApiError("access_denied"),
    );
    expect(await f.workspace.prepareFollowupResearch(f.current())).toBeNull();
    expect(f.workspace.sessionOwner.getSnapshot().phase).toBe("retired");
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(vi.mocked(f.api.saveFollowups).mock.calls[0]![1].aborted).toBe(true);
    held.resolve({
      version: command.expectedVersion + 1,
      payload: command.payload,
      replayed: false,
    });
    await saving;
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).toHaveBeenCalledOnce();
    noSources(f.api);
  });
});
