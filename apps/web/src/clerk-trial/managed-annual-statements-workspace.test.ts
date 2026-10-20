import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedResearchFollowupsDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import { eodSelection } from "./eod-history-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import type { ManagedAnnualStatementCellSelection } from "./managed-annual-statements-note";
import type { TrialSession } from "./session";

const digest = eodSelection.catalogSnapshotSha256;
const authored = "Café 東京 📈 thesis";
const chosen = Object.freeze([
  Object.freeze({ concept: "NetIncomeLoss", endDate: "2025-12-31" }),
  Object.freeze({ concept: "Assets", endDate: "2025-12-31" }),
] as const satisfies readonly ManagedAnnualStatementCellSelection[]);
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-statement-workspace",
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
async function fixture(
  options: {
    readonly loadAnnual?: boolean;
    readonly packet?: PersonalSecAnnualCanonicalResponseDto;
  } = {},
) {
  const response = options.packet ?? (await annualReportPacket());
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
    } satisfies MainWatchlistPayload,
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
    {
      readonly command: Parameters<ManagedApi["save"]>[0];
      readonly stored: typeof stored;
    }
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
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: vi
      .fn<ManagedApi["loadPortfolio"]>()
      .mockImplementation(unexpected),
    savePortfolio: vi
      .fn<ManagedApi["savePortfolio"]>()
      .mockImplementation(unexpected),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValue(response),
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation(unexpected),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockImplementation(unexpected),
    blsCalendar: vi.fn(),
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
    userId: "invented-statements-user",
    sessionId: "invented-statements-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    researchCoverage: inventedManagedResearchCoverage,
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
    workspace.openWatchlistAnnual(
      workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find(
          (entry) => entry.listingId === member.listingId,
        )!,
    );
  open();
  if (options.loadAnnual !== false) await workspace.annual.load();
  const selection = () => workspace.getSnapshot().research!.selection;
  const currentResponse = () => workspace.annual.getSnapshot().response!;
  const note = () =>
    workspace.coordinator
      .getSnapshot()
      .draft?.memberships.find((entry) => entry.listingId === member.listingId)
      ?.note;
  const prepare = (
    cells: readonly ManagedAnnualStatementCellSelection[] = chosen,
    guard = () => true,
  ) =>
    workspace.prepareAnnualStatementsNote(
      selection(),
      currentResponse(),
      cells,
      guard,
    );
  const preview = (
    cells: readonly ManagedAnnualStatementCellSelection[] = chosen,
    guard = () => true,
  ) => {
    const result = prepare(cells, guard);
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  const noOtherRequests = () => {
    for (const fn of [
      api.eodHistory,
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
  };
  return {
    workspace,
    api,
    session,
    response,
    member,
    other,
    selection,
    currentResponse,
    open,
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

describe("canonical statement cells through the real workspace draft and Save", () => {
  it("loads32concepts explicitly, previews two statement groups, appends once, reviews, saves and freshly loads the full exact note", async () => {
    const f = await fixture({ loadAnnual: false });
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(
      f.workspace.prepareAnnualStatementsNote(
        f.selection(),
        f.response,
        chosen,
        () => true,
      ).preview,
    ).toBeNull();
    await f.workspace.annual.load();
    const source = f.workspace.annual.getSnapshot();
    expect(source.response).toBe(f.response);
    expect(source.view?.canonical).toBe(f.response.evidence);
    expect(
      source.view?.statements.statements.flatMap((statement) => statement.rows),
    ).toHaveLength(32);
    const before = f.workspace.coordinator.getSnapshot().draft;
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const preview = f.preview();
    expect(preview.selection.map((cell) => cell.statement)).toEqual([
      "income_statement",
      "balance_sheet",
    ]);
    expect(preview.note.startsWith(`${authored} `)).toBe(true);
    expect(preview.note).toContain("USD -9007199254740993.000000000000000001");
    expect(preview.note).toContain("USD 9007199254740993.000000000000000001");
    expect(preview.note).toContain("period 2025-01-01 to 2025-12-31");
    expect(preview.note).toContain("as of 2025-12-31");
    expect(preview.note).toContain(f.response.evidence.generation.sha256);
    for (const cell of preview.selection)
      expect(preview.note).toContain(cell.observationIds[0]!);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(true);
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(true);
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.note()).toBe(preview.note);
    expect(f.api.save).not.toHaveBeenCalled();
    const review = renderToStaticMarkup(
      createElement(ManagedUnsavedWatchlistReview, {
        state: f.workspace.coordinator.getSnapshot(),
      }),
    );
    expect(review).toContain("Review unsaved changes");
    expect(review).toContain("1 changed listing");
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
    const reopened = new ManagedWorkspace(
      f.api,
      {
        ...f.session,
        sessionId: "invented-fresh-session",
      },
      undefined,
      { researchCoverage: inventedManagedResearchCoverage },
    );
    owners.push(reopened);
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft!.memberships).toEqual([
      f.other,
      { ...f.member, note: preview.note },
    ]);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    f.noOtherRequests();
  });
  it("owns frozen selected keys and refuses cloned or cross-workspace capabilities", async () => {
    const f = await fixture();
    const other = await fixture();
    const cells = [{ concept: "Assets" as const, endDate: "2025-12-31" }];
    const preview = f.preview(cells);
    cells[0]!.endDate = "2024-12-31";
    expect(preview.selection[0]!.endDate).toBe("2025-12-31");
    expect(Object.isFrozen(preview.selection[0])).toBe(true);
    expect(
      f.workspace.appendAnnualStatementsNote({ ...preview }).appended,
    ).toBe(false);
    expect(other.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(true);
    expect(
      f.workspace.prepareAnnualStatementsNote(
        { ...f.selection() },
        f.currentResponse(),
        chosen,
        () => true,
      ).preview,
    ).toBeNull();
    expect(
      f.workspace.prepareAnnualStatementsNote(
        f.selection(),
        structuredClone(f.currentResponse()),
        chosen,
        () => true,
      ).preview,
    ).toBeNull();
    expect(f.note()).toBe(authored);
    expect(other.note()).toBe(authored);
  });
  it("does not revive a preview after note edit then restore without an intermediate currentness call", async () => {
    const f = await fixture();
    const preview = f.preview();
    f.workspace.noteResearch(f.selection(), "Changed note");
    f.workspace.noteResearch(f.selection(), authored);
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
  });
  it("combines the view's permanent selection revision with workspace ownership", async () => {
    const f = await fixture();
    const initial = Symbol();
    let revision = initial;
    const preview = f.preview(chosen, () => revision === initial);
    revision = Symbol();
    const restoredSameCells = chosen.map((cell) => ({ ...cell }));
    expect(restoredSameCells).toEqual(chosen);
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.note()).toBe(authored);
    expect(f.prepare(chosen, () => false).preview).toBeNull();
    expect(
      f.prepare(chosen, () => {
        throw new Error("Retired reader");
      }).preview,
    ).toBeNull();
  });
  it("rechecks workspace state if the UI guard retires the visit during preparation", async () => {
    const f = await fixture();
    const result = f.prepare(chosen, () => {
      f.workspace.closeResearch();
      return true;
    });
    expect(result.preview).toBeNull();
    expect(f.note()).toBe(authored);
  });
  it("refuses Append if its UI guard changes the actual note during the currentness check", async () => {
    const f = await fixture();
    let editDuringGuard = false;
    const preview = f.preview(chosen, () => {
      if (editDuringGuard)
        f.workspace.noteResearch(f.selection(), "New authored note");
      return true;
    });
    editDuringGuard = true;
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.note()).toBe("New authored note");
    expect(f.api.save).not.toHaveBeenCalled();
    editDuringGuard = false;
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
  });
  it.each(["failure", "cancel"] as const)(
    "fences old previews after refresh start and retains the exact original pair after %s",
    async (outcome) => {
      const f = await fixture();
      const preview = f.preview();
      const pair = f.workspace.annual.getSnapshot();
      const held = deferred<PersonalSecAnnualCanonicalResponseDto>();
      vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
      const pending = f.workspace.annual.load();
      expect(f.prepare().preview).toBeNull();
      if (outcome === "failure") {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      } else f.workspace.annual.cancel();
      expect(f.workspace.annual.getSnapshot().response).toBe(pair.response);
      expect(f.workspace.annual.getSnapshot().view).toBe(pair.view);
      expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(false);
      expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
        false,
      );
      const retained = f.preview();
      expect(retained.showingPrevious).toBe(true);
      expect(retained.note).toContain("Retained previous report");
      expect(retained.note).toContain(
        f.response.evidence.generation.completedAt,
      );
      expect(f.workspace.appendAnnualStatementsNote(retained).appended).toBe(
        true,
      );
      const appended = f.workspace.coordinator.getSnapshot().draft;
      if (outcome === "cancel") {
        held.resolve(
          await annualReportPacket("left", { mode: "exact-decimal" }),
        );
        await pending;
      }
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(appended);
      expect(f.workspace.annual.getSnapshot().response).toBe(pair.response);
      f.noOtherRequests();
    },
  );
  it.each([
    "section round trip",
    "visit round trip",
    "navigation round trip",
    "source replacement",
    "catalog change",
    "member removal",
    "session retirement",
  ] as const)("permanently fences a preview after %s", async (boundary) => {
    const f = await fixture();
    const preview = f.preview();
    if (boundary === "section round trip") {
      f.workspace.switchToEod();
      f.workspace.switchToAnnual();
    }
    if (boundary === "visit round trip") {
      f.workspace.closeResearch();
      f.open();
    }
    if (boundary === "navigation round trip") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "source replacement") {
      vi.mocked(f.api.annualReport).mockResolvedValueOnce(
        await annualReportPacket("left", { mode: "exact-decimal" }),
      );
      await f.workspace.annual.load();
    }
    if (boundary === "catalog change") {
      vi.mocked(f.api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: `sha256:${"d".repeat(64)}` },
      });
      await f.workspace.refreshCatalog();
    }
    if (boundary === "member removal") f.workspace.remove(f.member.listingId);
    if (boundary === "session retirement") f.workspace.coordinator.retire();
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(f.api.save).not.toHaveBeenCalled();
  });
  it("rejects pending navigation and admits a new preview on the settled matching company route", async () => {
    const f = await fixture();
    const preview = f.preview();
    f.workspace.setNavigationBlocked(true);
    expect(f.prepare().preview).toBeNull();
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: f.member.listingId,
      section: "annual",
    });
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.prepare().preview).not.toBeNull();
    expect(f.api.save).not.toHaveBeenCalled();
  });
  it("requires the exact paired derived view, not merely a matching response", async () => {
    const f = await fixture();
    const annual = f.workspace.annual.getSnapshot();
    const snapshotSpy = vi
      .spyOn(f.workspace.annual, "getSnapshot")
      .mockReturnValue({ ...annual, view: null });
    expect(f.prepare().preview).toBeNull();
    snapshotSpy.mockRestore();
    expect(f.prepare().preview).not.toBeNull();
  });
  it.each([
    { cells: [] },
    { cells: [{ concept: "Assets", endDate: "2024-12-31" }] },
    { cells: [chosen[0], chosen[0]] },
  ] satisfies { cells: readonly ManagedAnnualStatementCellSelection[] }[])(
    "refuses empty, unavailable or duplicate selected cells %# as a whole",
    async ({ cells }) => {
      const f = await fixture();
      const before = f.workspace.coordinator.getSnapshot().draft;
      expect(f.prepare(cells).preview).toBeNull();
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(f.api.save).not.toHaveBeenCalled();
    },
  );
  it("does not substitute an unavailable income cell or hide an available balance cell", async () => {
    const f = await fixture({
      packet: await annualReportPacket("left", { mode: "income-invalid" }),
    });
    expect(f.prepare().preview).toBeNull();
    expect(f.preview([chosen[1]]).note).toContain("Assets");
    expect(f.note()).toBe(authored);
  });
  it("rejects malformed authored notes and whole overlong proposals without clipping", async () => {
    const f = await fixture();
    for (const note of ["Invalid\nnote", "界".repeat(1990)]) {
      f.workspace.noteResearch(f.selection(), note);
      const before = f.workspace.coordinator.getSnapshot().draft;
      const result = f.prepare();
      expect(result.preview).toBeNull();
      expect(result.reason).toBeTruthy();
      expect(f.note()).toBe(note);
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    }
    expect(f.api.save).not.toHaveBeenCalled();
  });
  it("accepts exactly2000 normalized code points and refuses one more before Append", async () => {
    const f = await fixture();
    f.workspace.noteResearch(f.selection(), "");
    const empty = f.preview();
    const room = 2000 - [...normalizeWatchlistNote(empty.note)!].length - 1;
    expect(room).toBeGreaterThan(0);
    f.workspace.noteResearch(f.selection(), "😀".repeat(room + 1));
    expect(f.prepare().preview).toBeNull();
    f.workspace.noteResearch(f.selection(), "😀".repeat(room));
    const exact = f.preview();
    expect([...normalizeWatchlistNote(exact.note)!]).toHaveLength(2000);
    expect(f.workspace.appendAnnualStatementsNote(exact).appended).toBe(true);
    expect(f.note()).toBe(exact.note);
  });
  it("keeps the appended draft through conflict, explicit latest review, keep draft and Save", async () => {
    const f = await fixture();
    const preview = f.preview();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(true);
    const appended = f.workspace.coordinator.getSnapshot().draft;
    vi.mocked(f.api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().conflict).toBe(true);
    expect(f.prepare().preview).toBeNull();
    f.setStored({
      version: 2,
      payload: {
        ...f.stored().payload,
        memberships: [f.other, { ...f.member, note: "Peer note" }],
      },
    });
    await f.workspace.coordinator.load();
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(appended);
    f.workspace.coordinator.keepDraft();
    await f.workspace.coordinator.save();
    expect(f.stored().version).toBe(3);
    expect(f.stored().payload.memberships[1]!.note).toBe(preview.note);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    f.noOtherRequests();
  });
  it("reconciles the original uncertain command once, preserving the note and independent draft", async () => {
    const f = await fixture();
    const preview = f.preview();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(true);
    const commit = vi.mocked(f.api.save).getMockImplementation()!;
    vi.mocked(f.api.save).mockImplementationOnce(async (command, signal) => {
      await commit(command, signal);
      throw new TrialApiError("commit_unknown");
    });
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.prepare().preview).toBeNull();
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    await f.workspace.coordinator.reconcile();
    expect(vi.mocked(f.api.save).mock.calls[1]![0]).toEqual(
      vi.mocked(f.api.save).mock.calls[0]![0],
    );
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: false,
      replayPending: true,
    });
    expect(f.note()).toBe(preview.note);
    expect(f.stored().version).toBe(2);
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
    f.noOtherRequests();
  });
  it("invalidates a held preview when Save starts and keeps the draft after an uncertain result", async () => {
    const f = await fixture();
    f.workspace.noteResearch(f.selection(), "Unsaved prior edit");
    const preview = f.preview();
    const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
    vi.mocked(f.api.save).mockReturnValueOnce(held.promise);
    const saving = f.workspace.coordinator.save();
    expect(f.prepare().preview).toBeNull();
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    held.reject(new TrialApiError("commit_unknown"));
    await saving;
    expect(f.note()).toBe("Unsaved prior edit");
    expect(f.workspace.annualStatementsPreviewIsCurrent(preview)).toBe(false);
  });
  it("does not consume another draft or restore a late Annual result after session retirement", async () => {
    const f = await fixture();
    const preview = f.preview();
    const stored = f.stored();
    const held = deferred<PersonalSecAnnualCanonicalResponseDto>();
    vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
    const pending = f.workspace.annual.load();
    f.workspace.coordinator.retire();
    held.resolve(f.response);
    await pending;
    expect(f.workspace.appendAnnualStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.annual.getSnapshot()).toMatchObject({
      response: null,
      view: null,
    });
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.stored()).toEqual(stored);
    expect(f.api.save).not.toHaveBeenCalled();
  });
});
