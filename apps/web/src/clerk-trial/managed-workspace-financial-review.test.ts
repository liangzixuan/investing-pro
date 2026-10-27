import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { viewOf } from "../features/research/test-canonical-annual-ui-fixture";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedResearchFollowupsDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { PersonalSecAnnualFinancialReviewKey } from "@research-cockpit/personal-financial-analytics";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { financialReviewResponse } from "./test-canonical-financial-review-fixture";
import { eodSelection } from "./eod-history-fixture";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { prepareCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import type { TrialSession } from "./session";

const digest = eodSelection.catalogSnapshotSha256;
const nextDigest = `sha256:${"d".repeat(64)}` as const;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-financial-review",
  catalogVersion: "invented-version",
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
const keys: readonly PersonalSecAnnualFinancialReviewKey[] = [
  "operatingIncome",
  "operatingCashFlow",
  "operatingCashFlowLessPpePurchases",
  "workingCapital",
  "shareholdersEquity",
];
const authored = "Café 東京 📈 thesis";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function fixture(
  packet?: PersonalSecAnnualCanonicalResponseDto,
  loadAnnual = true,
) {
  const response = packet ?? (await financialReviewResponse());
  const member = { ...eodSelection.listing, note: authored };
  const other = {
    ...member,
    listingId: "listing-other",
    securityId: "security-other",
    shareClassId: "class-other",
    symbol: "OTHER",
    note: "Other share class stays intact",
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
  const storedFollowups: ManagedResearchFollowupsDto = {
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
    Promise.reject(new Error("Unexpected unrelated invented fixture request"));
  const api: ManagedApi = {
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
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
    save: vi.fn<ManagedApi["save"]>().mockImplementation((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    }),
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockImplementation(() =>
        Promise.resolve(structuredClone(storedFollowups)),
      ),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation(unexpected),
  };
  const session: TrialSession = {
    userId: "invented-review-user",
    sessionId: "invented-review-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    researchCoverage: inventedManagedResearchCoverage,
  });
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.followups.coordinator.load();
  workspace.followups.edit(
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!,
    "check",
    "Unsaved independent follow-up · 東京",
  );
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find((row) => row.listingId === member.listingId)!,
    );
  open();
  if (loadAnnual) await workspace.annual.load();
  const selection = workspace.getSnapshot().research!.selection;
  const currentResponse = () => workspace.annual.getSnapshot().response!;
  const prepare = (
    chosen: readonly PersonalSecAnnualFinancialReviewKey[] = [
      "operatingIncome",
    ],
  ) => workspace.prepareFinancialReview(selection, currentResponse(), chosen);
  const preview = (chosen?: readonly PersonalSecAnnualFinancialReviewKey[]) => {
    const result = prepare(chosen);
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  return {
    workspace,
    api,
    session,
    response,
    member,
    other,
    selection,
    open,
    prepare,
    preview,
    currentResponse,
    stored: () => structuredClone(stored),
    setStored: (next: typeof stored) => {
      stored = structuredClone(next);
    },
    storedFollowups: () => structuredClone(storedFollowups),
  };
}
function noOtherRequests(api: ManagedApi) {
  for (const fn of [
    api.eodHistory,
    api.recentFilings,
    api.economicCalendar,
    api.monetaryAnnouncements,
    api.resolve,
    api.search,
    api.saveFollowups,
  ])
    expect(fn).not.toHaveBeenCalled();
  expect(api.loadFollowups).toHaveBeenCalledOnce();
}
function note(f: Awaited<ReturnType<typeof fixture>>) {
  return f.workspace.getResearchWatchlist(f.selection).member!.note;
}

describe("composed explicit company financial review", () => {
  it("prepares and appends on the settled Company URL while outer workspace navigation is blocked", async () => {
    const f = await fixture();
    f.workspace.setNavigationBlocked(true);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: f.member.listingId,
      section: "annual",
    });
    expect(f.workspace.getSnapshot().companyRoute).toMatchObject({
      status: "open",
      listingId: f.member.listingId,
    });
    expect(f.workspace.getResearchWatchlist(f.selection).canEdit).toBe(true);
    const preview = f.preview();
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(true);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
    expect(note(f)).toBe(preview.note);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(f.api.save).not.toHaveBeenCalled();
    noOtherRequests(f.api);
  });

  it("refuses pending navigation and fences its old preview after the same Company route settles again", async () => {
    const f = await fixture();
    const old = f.preview();
    f.workspace.setNavigationBlocked(true);
    expect(f.prepare().preview).toBeNull();
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: f.member.listingId,
      section: "annual",
    });
    expect(f.workspace.financialReviewPreviewIsCurrent(old)).toBe(false);
    expect(f.workspace.appendFinancialReview(old).appended).toBe(false);
    expect(f.prepare().preview).not.toBeNull();
    expect(f.api.save).not.toHaveBeenCalled();
    noOtherRequests(f.api);
  });

  it("admits independent mixed facts even without any income/revenue pair", async () => {
    const response = await financialReviewResponse();
    const { evidence } = response;
    expect(
      evidence.facts.observations.filter((row) =>
        [
          "Revenues",
          "SalesRevenueNet",
          "RevenueFromContractWithCustomerExcludingAssessedTax",
          "NetIncomeLoss",
        ].includes(row.concept),
      ),
    ).toEqual([]);
    expect(
      viewOf(response).operatingResults.resolution.operatingIncome,
    ).toMatchObject({
      status: "available",
      value: "250.125",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(
      viewOf(response).cashGeneration.resolution.operatingCashFlow,
    ).toMatchObject({
      status: "available",
      value: "120.125",
    });
    expect(
      viewOf(response).cashGeneration.resolution
        .operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "-80.125" });
    expect(viewOf(response).liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "0",
      asOfDate: "2025-12-31",
    });
    expect(
      viewOf(response).balanceSheet.resolution.shareholdersEquity,
    ).toMatchObject({
      status: "available",
      value: "-7.5",
      asOfDate: "2025-12-31",
    });
  });

  it("loads explicitly, previews without writing, appends once, captures full evidence, then saves/reloads the whole draft", async () => {
    const f = await fixture(undefined, false);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(
      f.workspace.prepareFinancialReview(f.selection, f.response, keys).preview,
    ).toBeNull();
    await f.workspace.annual.load();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const before = f.workspace.coordinator.getSnapshot().draft;
    const selected = ["operatingIncome", "shareholdersEquity"] as const;
    const preview = f.preview(selected);
    expect(preview.note).toContain(authored);
    expect(preview.note).toContain("250.125");
    expect(preview.note).toContain("-7.5");
    expect(preview.note).toContain(f.response.evidence.generation.completedAt);
    expect(preview.note).toContain(f.response.evidence.generation.sha256);
    expect(preview.note).toContain(f.response.evidence.generation.cutoffAt);
    expect(preview.note).toContain(
      f.response.evidence.generation.sources.companyFacts.fetchedAt!,
    );
    expect(preview.note).toContain(
      f.response.evidence.generation.sources.submissions.fetchedAt!,
    );
    expect(preview.note).toContain(
      f.response.evidence.facts.observations.find(
        (row) => row.concept === "OperatingIncomeLoss",
      )!.id,
    );
    expect(preview.note).toContain(
      f.response.evidence.facts.observations.find(
        (row) => row.concept === "StockholdersEquity",
      )!.id,
    );
    expect(preview.note).toContain("2025-01-01 to 2025-12-31");
    expect(preview.note).toContain("as of 2025-12-31");
    expect(preview.note).toContain(
      f.response.evidence.target.status === "target"
        ? f.response.evidence.target.accessionNumber
        : "missing filing",
    );
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.keys)).toBe(true);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
    expect(note(f)).toBe(preview.note);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft!.memberships[0]).toEqual(
      f.other,
    );
    const evidence = companySnapshotEvidence(
      f.selection,
      f.workspace.eod.getSnapshot(),
      f.workspace.annual.getSnapshot(),
      f.workspace.filings.getSnapshot(),
      null,
    );
    const report = prepareCompanyReport(
      f.selection,
      evidence,
      f.workspace.getResearchWatchlist(f.selection),
      () => new Date("2026-10-16T00:00:00.000Z"),
    );
    expect(report).not.toBeNull();
    const document = formatCompanyReportDocument(report!);
    expect(document).not.toBeNull();
    const captured: unknown = JSON.parse(document!.text);
    expect(captured).toHaveProperty("authoredResearch.note", preview.note);
    expect(captured).toHaveProperty(
      "sources.annual.response",
      f.currentResponse(),
    );
    expect(captured).toHaveProperty("sources.price.status", "not_loaded");
    expect(captured).toHaveProperty("sources.filings.status", "not_loaded");
    expect(f.api.save).not.toHaveBeenCalled();
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(vi.mocked(f.api.save).mock.calls[0]![0].payload).toEqual(
      f.workspace.coordinator.getSnapshot().draft,
    );
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.storedFollowups().payload.entries[0]!.check).toBe(
      "Review next filing",
    );
    const reopened = new ManagedWorkspace(
      f.api,
      {
        ...f.session,
        sessionId: "invented-new-session",
      },
      undefined,
      { researchCoverage: inventedManagedResearchCoverage },
    );
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(
      f.stored().payload,
    );
    expect(reopened.coordinator.getSnapshot().draft!.memberships[1]!.note).toBe(
      preview.note,
    );
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    noOtherRequests(f.api);
  });

  it.each(["😀", "e\u0301"])(
    "enforces the complete 2,000-code-point note limit with %s and no partial append",
    async (unit) => {
      const f = await fixture();
      f.workspace.noteResearch(f.selection, "");
      const empty = f.preview();
      f.workspace.noteResearch(f.selection, unit);
      const one = f.preview();
      const extra =
        [...normalizeWatchlistNote(one.note)!].length -
        [...normalizeWatchlistNote(empty.note)!].length;
      const room =
        2000 - [...normalizeWatchlistNote(empty.note)!].length - (extra - 1);
      expect(room).toBeGreaterThan(0);
      f.workspace.noteResearch(f.selection, unit.repeat(room + 1));
      const oversized = f.workspace.coordinator.getSnapshot().draft;
      expect(f.prepare().preview).toBeNull();
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(oversized);
      expect(note(f)).toBe(unit.repeat(room + 1));
      f.workspace.noteResearch(f.selection, unit.repeat(room));
      const exact = f.preview();
      expect([...normalizeWatchlistNote(exact.note)!]).toHaveLength(2000);
      expect(f.workspace.appendFinancialReview(exact).appended).toBe(true);
      expect(note(f)).toBe(exact.note);
      expect(note(f)).toContain("250.125");
      expect(f.api.save).not.toHaveBeenCalled();
      noOtherRequests(f.api);
    },
  );

  it("refuses all selected facts as a unit when authored text leaves insufficient room", async () => {
    const f = await fixture();
    f.workspace.noteResearch(f.selection, "界".repeat(1990));
    const before = f.workspace.coordinator.getSnapshot().draft;
    const result = f.prepare(keys);
    expect(result.preview).toBeNull();
    expect(result.reason).toBeTruthy();
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(note(f)).toBe("界".repeat(1990));
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("retains an isolated refusal without hiding the other facts", async () => {
    const f = await fixture(
      await financialReviewResponse({ shareholdersEquity: null }),
    );
    const before = f.workspace.coordinator.getSnapshot().draft;
    const preview = f.preview(["shareholdersEquity"]);
    expect(preview.note).toMatch(/unavailable|missing/iu);
    expect(preview.note).not.toContain("-7.5");
    expect(
      viewOf(f.currentResponse()).operatingResults.resolution.operatingIncome,
    ).toMatchObject({ status: "available", value: "250.125" });
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    noOtherRequests(f.api);
  });

  it("does not resurrect a preview after editing and restoring the same note", async () => {
    const f = await fixture();
    const preview = f.preview();
    f.workspace.noteResearch(f.selection, "Changed thesis");
    f.workspace.noteResearch(f.selection, authored);
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(note(f)).toBe(authored);
  });

  it("keeps historical eligibility and original clocks rather than reassessing them at preview", async () => {
    const f = await fixture(
      await financialReviewResponse({ cutoffAt: "2028-09-20T00:00:00.000Z" }),
    );
    const preview = f.preview();
    expect(
      viewOf(f.currentResponse()).operatingResults.resolution.operatingIncome,
    ).toMatchObject({ status: "available", currentUseEligible: false });
    expect(preview.note).toContain("historical; current use ineligible");
    expect(preview.note).toContain("2028-09-20T00:00:00.000Z");
    expect(preview.note).toContain("2028-09-20T00:00:02.000Z");
    expect(note(f)).toBe(authored);
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(f.api.save).not.toHaveBeenCalled();
    noOtherRequests(f.api);
  });

  it("owns the handle and selected keys, refusing cloned/fabricated/cross-workspace previews", async () => {
    const f = await fixture();
    const selected: PersonalSecAnnualFinancialReviewKey[] = ["operatingIncome"];
    const preview = f.preview(selected);
    selected[0] = "workingCapital";
    expect(preview.keys).toEqual(["operatingIncome"]);
    expect(f.workspace.appendFinancialReview({ ...preview }).appended).toBe(
      false,
    );
    expect(
      f.workspace.appendFinancialReview({
        note: "Invented injection",
        keys: [],
      }).appended,
    ).toBe(false);
    expect(
      f.workspace.prepareFinancialReview(
        { ...f.selection },
        f.currentResponse(),
        keys,
      ).preview,
    ).toBeNull();
    expect(
      f.workspace.prepareFinancialReview(
        f.selection,
        structuredClone(f.currentResponse()),
        keys,
      ).preview,
    ).toBeNull();
    const other = await fixture();
    expect(other.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(note(other)).toBe(authored);
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(true);
    expect(note(f)).toBe(authored);
    noOtherRequests(f.api);
  });

  it.each(["failure", "Cancel"] as const)(
    "invalidates at refresh start and retains original evidence after %s, fencing late completion",
    async (outcome) => {
      const f = await fixture();
      const preview = f.preview();
      const original = f.currentResponse();
      const independent = f.workspace.followups.coordinator.getSnapshot().draft;
      const held = deferred<PersonalSecAnnualCanonicalResponseDto>();
      vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
      const pending = f.workspace.annual.load();
      expect(f.prepare().preview).toBeNull();
      expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
      if (outcome === "failure") {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      } else f.workspace.annual.cancel();
      expect(f.currentResponse()).toBe(original);
      expect(f.workspace.annual.getSnapshot().showingPrevious).toBe(true);
      expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
      const retained = f.preview();
      expect(retained.note).toMatch(/retained|previous/iu);
      expect(retained.note).toContain(original.evidence.generation.completedAt);
      expect(f.workspace.appendFinancialReview(retained).appended).toBe(true);
      const appended = f.workspace.coordinator.getSnapshot().draft;
      if (outcome === "Cancel") {
        held.resolve(
          await financialReviewResponse({ operatingIncome: "999.875" }),
        );
        await pending;
      }
      expect(f.currentResponse()).toBe(original);
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(appended);
      expect(note(f)).not.toContain("999.875");
      expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
        independent,
      );
      expect(f.api.annualReport).toHaveBeenCalledTimes(2);
      expect(f.api.save).not.toHaveBeenCalled();
      noOtherRequests(f.api);
    },
  );

  it.each([
    "replacement",
    "section round trip",
    "visit round trip",
    "catalog change",
    "member removal",
    "session retirement",
  ] as const)("fences a preview after %s", async (boundary) => {
    const f = await fixture();
    const preview = f.preview();
    const independentStored = f.storedFollowups();
    if (boundary === "replacement") {
      vi.mocked(f.api.annualReport).mockResolvedValueOnce(
        await financialReviewResponse({
          operatingIncome: "300.25",
          cutoffAt: "2026-09-21T00:00:00.000Z",
        }),
      );
      await f.workspace.annual.load();
    } else if (boundary === "section round trip") {
      f.workspace.switchToEod();
      f.workspace.switchToAnnual();
    } else if (boundary === "visit round trip") {
      f.workspace.closeResearch();
      f.open();
    } else if (boundary === "catalog change") {
      vi.mocked(f.api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: nextDigest },
      });
      await f.workspace.refreshCatalog();
    } else if (boundary === "member removal") {
      const draft = f.workspace.coordinator.getSnapshot().draft!;
      f.workspace.coordinator.replaceDraft({
        ...draft,
        memberships: [draft.memberships[0]!],
      });
    } else f.workspace.coordinator.retire();
    const before = f.workspace.coordinator.getSnapshot().draft;
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(f.storedFollowups()).toEqual(independentStored);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.annualReport).toHaveBeenCalledTimes(
      boundary === "replacement" ? 2 : 1,
    );
    noOtherRequests(f.api);
  });

  it("invalidates an unconsumed preview when an explicit whole-draft save starts", async () => {
    const f = await fixture();
    f.workspace.noteResearch(f.selection, "Unsaved thesis · Café 東京 📈");
    const preview = f.preview();
    const before = f.workspace.coordinator.getSnapshot().draft;
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const held = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
    vi.mocked(f.api.save).mockReturnValueOnce(held.promise);
    const saving = f.workspace.coordinator.save();
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(before);
    held.reject(new TrialApiError("unavailable"));
    await saving;
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(before);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.api.save).toHaveBeenCalledOnce();
    noOtherRequests(f.api);
  });

  it("rejects a held Annual completion after session retirement without restoring either draft", async () => {
    const f = await fixture();
    const preview = f.preview();
    const originalStored = f.stored();
    const independentStored = f.storedFollowups();
    const held = deferred<PersonalSecAnnualCanonicalResponseDto>();
    vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
    const pending = f.workspace.annual.load();
    f.workspace.coordinator.retire();
    held.resolve(await financialReviewResponse({ operatingIncome: "999.875" }));
    await pending;
    expect(f.workspace.financialReviewPreviewIsCurrent(preview)).toBe(false);
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.workspace.annual.getSnapshot().response).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.stored()).toEqual(originalStored);
    expect(f.storedFollowups()).toEqual(independentStored);
    expect(f.api.annualReport).toHaveBeenCalledTimes(2);
    expect(f.api.save).not.toHaveBeenCalled();
    noOtherRequests(f.api);
  });

  it("preserves the appended draft and independent Follow-ups through conflict and explicit latest-version review", async () => {
    const f = await fixture();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const preview = f.preview();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
    const appended = f.workspace.coordinator.getSnapshot().draft!;
    vi.mocked(f.api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().conflict).toBe(true);
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(appended);
    expect(f.prepare().preview).toBeNull();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    f.setStored({
      version: 2,
      payload: {
        ...f.stored().payload,
        memberships: f
          .stored()
          .payload.memberships.map((member, index) =>
            index === 1 ? { ...member, note: "Peer version" } : member,
          ),
      },
    });
    await f.workspace.coordinator.load();
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(appended);
    expect(f.api.save).toHaveBeenCalledOnce();
    f.workspace.coordinator.keepDraft();
    await f.workspace.coordinator.save();
    expect(f.api.save).toHaveBeenCalledTimes(2);
    expect(f.stored().version).toBe(3);
    expect(f.stored().payload.memberships[1]!.note).toBe(preview.note);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    noOtherRequests(f.api);
  });

  it("reconciles an uncertain save only with the exact original command, without a second append or Follow-ups write", async () => {
    const f = await fixture();
    const independent = f.workspace.followups.coordinator.getSnapshot().draft;
    const preview = f.preview();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(true);
    vi.mocked(f.api.save).mockImplementationOnce((command) => {
      f.setStored({
        version: command.expectedVersion + 1,
        payload: command.payload,
      });
      return Promise.reject(new TrialApiError("commit_unknown"));
    });
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().uncertain).toBe(true);
    expect(note(f)).toBe(preview.note);
    expect(f.prepare().preview).toBeNull();
    expect(f.workspace.appendFinancialReview(preview).appended).toBe(false);
    expect(f.api.save).toHaveBeenCalledOnce();
    vi.mocked(f.api.save).mockResolvedValueOnce({
      ...f.stored(),
      replayed: true,
    });
    await f.workspace.coordinator.reconcile();
    expect(f.api.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(f.api.save).mock.calls[1]![0]).toEqual(
      vi.mocked(f.api.save).mock.calls[0]![0],
    );
    expect(f.workspace.coordinator.getSnapshot().uncertain).toBe(false);
    expect(
      f.workspace.coordinator.getSnapshot().draft?.memberships[1]!.note,
    ).toBe(preview.note);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
      independent,
    );
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    noOtherRequests(f.api);
  });
});
