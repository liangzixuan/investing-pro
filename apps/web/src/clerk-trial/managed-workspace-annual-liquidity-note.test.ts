import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { viewOf } from "../features/research/test-canonical-annual-ui-fixture";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import {
  liquidityResponse,
  liquidityRow,
} from "../features/research/test-canonical-annual-liquidity-ui-fixture";
import { request } from "../features/research/test-canonical-annual-read-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import { annualOperatingNoteExcerpt } from "./managed-annual-operating-note";
import {
  operatingResponse,
  operatingRow,
} from "../features/research/test-canonical-annual-operating-ui-fixture";
import { eodSelection } from "./eod-history-fixture";
import type { TrialSession } from "./session";

type Report = PersonalSecAnnualCanonicalResponseDto;
const digest = eodSelection.catalogSnapshotSha256;
const nextDigest = `sha256:${"b".repeat(64)}` as const;
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function report(
  assets = "120.125",
  liabilities = "80.025",
  cutoff?: string,
) {
  const parsed = await parseSecAnnualCanonicalResponse(
    await liquidityResponse(
      [
        liquidityRow("current_assets", assets),
        liquidityRow("current_liabilities", liabilities),
      ],
      cutoff,
    ),
    request(),
    new AbortController().signal,
  );
  if (!parsed) throw new Error("Invalid invented liquidity packet");
  return parsed;
}
async function fixture(packet?: Report, loadAnnual = true) {
  const response = packet ?? (await report());
  const member = { ...eodSelection.listing, note: "Original thesis" };
  const other = {
    ...member,
    listingId: "listing-other",
    securityId: "security-other",
    shareClassId: "class-other",
    shareClassName: "Class B",
    symbol: "OTHER",
    note: "Keep the other share class",
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
  const unexpected = () =>
    Promise.reject(new Error("Unexpected unrelated fixture request"));
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
  };
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    researchCoverage: inventedManagedResearchCoverage,
  });
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator
        .getSnapshot()
        .draft!.memberships.find((row) => row.listingId === member.listingId)!,
    );
  if (loadAnnual) {
    open();
    await workspace.annual.load();
  }
  const selection = workspace.getSnapshot().research?.selection;
  return {
    workspace,
    api,
    session,
    response,
    member,
    other,
    open,
    selection: selection!,
    saved: () => structuredClone(stored),
    append: () =>
      workspace.appendAnnualLiquidityToResearchNote(selection!, response),
  };
}
function noOtherRequests(api: ManagedApi) {
  for (const method of [
    api.eodHistory,
    api.recentFilings,
    api.economicCalendar,
    api.monetaryAnnouncements,
    api.resolve,
    api.search,
  ])
    expect(method).not.toHaveBeenCalled();
}

describe("workspace Annual operating note action", () => {
  it("fences an old response after successful replacement and direct Annual retirement", async () => {
    const { workspace, api, selection, response } = await fixture(
      await operatingResponse(),
    );
    const basis = viewOf(response).operatingResults.resolution.margins[1]!;
    const replacement = await operatingResponse([operatingRow("300")]);
    vi.mocked(api.annualReport).mockResolvedValueOnce(replacement);
    await workspace.annual.load();
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    const current = workspace.annual.getSnapshot().response!;
    const chosen = viewOf(current).operatingResults.resolution.margins[1]!;
    expect(
      workspace.getAnnualOperatingNoteAction(selection, current, chosen)
        .canAppend,
    ).toBe(true);
    workspace.coordinator.retire();
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, current, chosen)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("accepts exactly 2,000 normalized code points and refuses one more without truncation", async () => {
    const { workspace, api, selection, response } = await fixture(
      await operatingResponse(),
    );
    const basis = viewOf(response).operatingResults.resolution.margins[1]!;
    const excerpt = annualOperatingNoteExcerpt(response, basis, false)!;
    const room = 2000 - [...excerpt].length - 1;
    workspace.noteResearch(selection, "😀".repeat(room + 1));
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.noteResearch(selection, "😀".repeat(room));
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(true);
    expect([
      ...normalizeWatchlistNote(
        workspace.getResearchWatchlist(selection).member!.note,
      )!,
    ]).toHaveLength(2000);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).toHaveBeenCalledOnce();
  });
  it("uses latest Unicode prose and one exact basis, then saves the whole draft explicitly", async () => {
    const raw = await operatingResponse([operatingRow("-25.125")]);
    const packet = await parseSecAnnualCanonicalResponse(
      raw,
      request(),
      new AbortController().signal,
    );
    expect(packet).not.toBeNull();
    const { workspace, api, selection, response, saved } = await fixture(
      packet!,
    );
    const basis = viewOf(response).operatingResults.resolution.margins.find(
      (b) => b.concept === "Revenues",
    )!;
    const prose = "  Café thesis 😀  keep whitespace  ";
    workspace.noteResearch(selection, prose);
    expect(
      workspace.getAnnualOperatingNoteAction(selection, response, basis),
    ).toEqual({ canAppend: true, reason: null });
    const text = annualOperatingNoteExcerpt(response, basis, false)!;
    const before = workspace.coordinator.getSnapshot().draft!;
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(true);
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      prose + " " + text,
    );
    expect(workspace.coordinator.getSnapshot().draft!.memberships[0]).toEqual(
      before.memberships[0],
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).toHaveBeenCalledOnce();
    noOtherRequests(api);
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(saved().payload.memberships[1]?.note).toBe(
      normalizeWatchlistNote(prose + " " + text),
    );
  });

  it("refuses copied basis and stale response, waits during refresh, and fences retirement", async () => {
    const { workspace, api, selection, response } = await fixture(
      await operatingResponse(),
    );
    const basis = viewOf(response).operatingResults.resolution.margins.find(
      (b) => b.concept === "Revenues",
    )!;
    expect(
      workspace.getAnnualOperatingNoteAction(selection, response, { ...basis })
        .canAppend,
    ).toBe(false);
    const waiting = deferred<Report>();
    vi.mocked(api.annualReport).mockReturnValueOnce(waiting.promise);
    const pending = workspace.annual.load();
    expect(
      workspace.getAnnualOperatingNoteAction(selection, response, basis)
        .canAppend,
    ).toBe(false);
    workspace.annual.cancel();
    expect(
      workspace.getAnnualOperatingNoteAction(selection, response, basis)
        .canAppend,
    ).toBe(true);
    const replacement = await operatingResponse([operatingRow("300")]);
    waiting.resolve(replacement);
    await pending;
    expect(workspace.annual.getSnapshot().response).toBe(response);
    workspace.switchToEod();
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    workspace.coordinator.retire();
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("refuses oversized prose without truncation or a request", async () => {
    const { workspace, api, selection, response } = await fixture(
      await operatingResponse(),
    );
    const basis = viewOf(response).operatingResults.resolution.margins.find(
      (b) => b.concept === "Revenues",
    )!;
    workspace.noteResearch(selection, "x".repeat(2000));
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendAnnualOperatingToResearchNote(selection, response, basis)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe("workspace Annual liquidity note action", () => {
  it("uses latest raw prose and preserves the complete draft until explicit whole-list Save and reload", async () => {
    const { workspace, api, response, selection, append, saved, session } =
      await fixture();
    expect(workspace.getAnnualLiquidityNoteAction(selection, response)).toEqual(
      { canAppend: true, reason: null },
    );
    const prose = "  Cafe\u0301 thesis revised after rendering 😀  ";
    workspace.noteResearch(selection, prose);
    const before = workspace.coordinator.getSnapshot().draft!;
    const excerpt = annualLiquidityNoteExcerpt(response, false)!;
    expect(append()).toEqual({
      appended: true,
      message:
        "Liquidity added to the note draft. Review and save all changes in My Watchlist.",
    });
    const complete = {
      ...before,
      memberships: [
        before.memberships[0]!,
        { ...before.memberships[1]!, note: prose + " " + excerpt },
      ],
    };
    expect(workspace.coordinator.getSnapshot().draft).toEqual(complete);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).toHaveBeenCalledOnce();
    noOtherRequests(api);
    workspace.switchToEod();
    workspace.closeResearch();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(complete);
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    const normalized = {
      ...complete,
      memberships: [
        complete.memberships[0],
        {
          ...complete.memberships[1]!,
          note: normalizeWatchlistNote(prose + " " + excerpt)!,
        },
      ],
    };
    expect(vi.mocked(api.save).mock.calls[0]![0]).toMatchObject({
      expectedVersion: 1,
      payload: normalized,
    });
    expect(saved()).toEqual({ version: 2, payload: normalized });
    const reopened = new ManagedWorkspace(api, session, undefined, {
      researchCoverage: inventedManagedResearchCoverage,
    });
    await reopened.coordinator.load();
    expect(reopened.coordinator.getSnapshot().draft).toEqual(normalized);
  });

  it("refuses exact duplicates and permits explicit removal then re-add", async () => {
    const { workspace, selection, response, append, api } = await fixture();
    expect(append().appended).toBe(true);
    const before = workspace.coordinator.getSnapshot().draft;
    expect(append()).toEqual({
      appended: false,
      message: "This exact liquidity reference is already in the note draft.",
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.noteResearch(selection, "New thesis");
    expect(append().appended).toBe(true);
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      "New thesis " + annualLiquidityNoteExcerpt(response, false),
    );
    expect(api.save).not.toHaveBeenCalled();
  });

  it("records a checked zero-liability refusal alongside the valid balances and working capital", async () => {
    const { workspace, selection, append } = await fixture(
      await report("120.125", "0"),
    );
    expect(append().appended).toBe(true);
    expect(workspace.getResearchWatchlist(selection).member?.note).toContain(
      "App calculations: working capital USD 120.125; current ratio unavailable because current liabilities are zero.",
    );
  });

  it.each(["-1", "0"])(
    "blocks unsupported or missing calculation evidence (%s)",
    async (amount) => {
      const packet =
        amount === "-1"
          ? await report(amount, "80")
          : await liquidityResponse([]);
      const { workspace, selection, response, append, api } =
        await fixture(packet);
      const before = workspace.coordinator.getSnapshot().draft;
      expect(
        workspace.getAnnualLiquidityNoteAction(selection, response),
      ).toEqual({
        canAppend: false,
        reason:
          "Liquidity needs available nonnegative current assets and liabilities from the same filing and balance date.",
      });
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "copied selection",
    "copied response",
    "reopened visit",
    "other listing",
    "closed visit",
    "Price section",
    "Filings section",
    "equal replacement",
    "catalog change",
    "retirement",
  ])("fences a captured action after %s", async (boundary) => {
    const setup = await fixture();
    const { workspace, api, response, open } = setup;
    let selection = setup.selection;
    let captured = response;
    if (boundary === "copied selection") selection = { ...selection };
    else if (boundary === "copied response") captured = { ...response };
    else if (boundary === "reopened visit") {
      workspace.closeResearch();
      open();
      await workspace.annual.load();
    } else if (boundary === "other listing")
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
    else if (boundary === "closed visit") workspace.closeResearch();
    else if (boundary === "Price section") workspace.switchToEod();
    else if (boundary === "Filings section") workspace.switchToFilings();
    else if (boundary === "equal replacement") {
      vi.mocked(api.annualReport).mockResolvedValueOnce(
        structuredClone(response),
      );
      await workspace.annual.load();
    } else if (boundary === "catalog change") {
      vi.mocked(api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: nextDigest },
      });
      await workspace.refreshCatalog();
    } else workspace.coordinator.retire();
    const before = workspace.coordinator.getSnapshot().draft;
    const reads = vi.mocked(api.annualReport).mock.calls.length;
    expect(
      workspace.getAnnualLiquidityNoteAction(selection, captured).canAppend,
    ).toBe(false);
    expect(
      workspace.appendAnnualLiquidityToResearchNote(selection, captured)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.annualReport).toHaveBeenCalledTimes(reads);
    expect(api.save).not.toHaveBeenCalled();
    noOtherRequests(api);
  });

  it.each(["Cancel", "failure"])(
    "blocks pending refresh then qualifies retained evidence after %s, fencing late completion",
    async (outcome) => {
      const { workspace, api, response, selection, append } = await fixture(
        await report("120.125", "80.025", "2028-09-20T00:00:00.000Z"),
      );
      const held = deferred<Report>();
      vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
      const pending = workspace.annual.load();
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append()).toEqual({
        appended: false,
        message: "Wait for the Annual report request to finish or cancel it.",
      });
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      if (outcome === "Cancel") workspace.annual.cancel();
      else {
        held.reject(new TrialApiError("unavailable"));
        await pending;
      }
      expect(append().appended).toBe(true);
      const appended = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getResearchWatchlist(selection).member?.note).toContain(
        "Historical evidence; current-use policy at original load: unavailable. Retained previous report.",
      );
      if (outcome === "Cancel") {
        held.resolve(await report("999", "10"));
        await pending;
      }
      expect(workspace.annual.getSnapshot().response).toBe(response);
      expect(workspace.coordinator.getSnapshot().draft).toBe(appended);
      expect(api.save).not.toHaveBeenCalled();
      noOtherRequests(api);
    },
  );

  it("only appends the checked company-owned response after a comparison handoff", async () => {
    const { workspace, api, response } = await fixture(undefined, false);
    const model = workspace.annualComparison;
    const member = model
      .getSnapshot()
      .memberships.find((row) => row.listing.listingId === "listing-zero")!;
    model.select("left", model.getSnapshot(), member);
    await model.load("left", member);
    const original = {
      side: "left" as const,
      member,
      response: model.getSnapshot().left.report.response!,
    };
    workspace.openAnnualComparisonReport(original);
    await vi.waitFor(() =>
      expect(workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    const selected = workspace.getSnapshot().research!.selection;
    const owned = workspace.annual.getSnapshot().response!;
    expect(owned).not.toBe(response);
    expect(owned).toEqual(response);
    expect(
      workspace.appendAnnualLiquidityToResearchNote(selected, response)
        .appended,
    ).toBe(false);
    expect(
      workspace.appendAnnualLiquidityToResearchNote(selected, owned).appended,
    ).toBe(true);
    expect(workspace.getResearchWatchlist(selected).member?.note).toBe(
      "Original thesis " + annualLiquidityNoteExcerpt(response, false),
    );
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["missing member", "changed identity", "stale draft catalog"])(
    "preserves %s without auto-adding or changing the draft",
    async (boundary) => {
      const { workspace, selection, append, api } = await fixture();
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
                  ? { ...member, shareClassId: "changed-class" }
                  : member,
              ),
      });
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(api.save).not.toHaveBeenCalled();
      if (boundary === "missing member") {
        expect(workspace.getSnapshot().research).toBeNull();
        workspace.addResearchToWatchlist(selection);
        expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      }
    },
  );

  it("requires explicit membership Add from Discover and then appends without a new Annual read", async () => {
    const { workspace, api, member, response } = await fixture(
      undefined,
      false,
    );
    workspace.coordinator.replaceDraft({
      ...workspace.coordinator.getSnapshot().draft!,
      memberships: [],
    });
    workspace.setView("discover");
    const result: PersonalSecurityMasterSearchResultDto = {
      ...member,
      cik: "0000000001",
      matchKind: "current_symbol_exact",
      matchedValue: "ZERO",
    };
    vi.mocked(api.search).mockResolvedValueOnce({
      snapshot,
      results: [result],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    });
    workspace.setQuery("ZERO");
    await workspace.search();
    workspace.openDiscoveryAnnual(workspace.getSnapshot().results[0]!);
    await workspace.annual.load();
    const selection = workspace.getSnapshot().research!.selection;
    expect(workspace.getAnnualLiquidityNoteAction(selection, response)).toEqual(
      {
        canAppend: false,
        reason:
          "Add this company to the watchlist draft before adding liquidity.",
      },
    );
    const before = workspace.coordinator.getSnapshot().draft;
    expect(
      workspace.appendAnnualLiquidityToResearchNote(selection, response)
        .appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    workspace.addResearchToWatchlist(selection);
    expect(
      workspace.appendAnnualLiquidityToResearchNote(selection, response)
        .appended,
    ).toBe(true);
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      annualLiquidityNoteExcerpt(response, false),
    );
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.search).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["loading", "saving", "conflict", "commit_unknown"] as const)(
    "respects %s coordinator state",
    async (boundary) => {
      const { workspace, selection, append, api } = await fixture();
      workspace.noteResearch(selection, "Changed thesis");
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
    "accepts exactly 2,000 normalized code points with %s and preserves raw text on overflow",
    async (unit) => {
      const { workspace, selection, response, append, api } = await fixture();
      const excerpt = annualLiquidityNoteExcerpt(response, false)!;
      const room = 2000 - [...excerpt].length - 1;
      workspace.noteResearch(selection, unit.repeat(room + 1));
      const before = workspace.coordinator.getSnapshot().draft;
      expect(append().appended).toBe(false);
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      workspace.noteResearch(selection, unit.repeat(room));
      expect(append().appended).toBe(true);
      const note = workspace.getResearchWatchlist(selection).member!.note;
      expect(note).toBe(unit.repeat(room) + " " + excerpt);
      expect([...normalizeWatchlistNote(note)!]).toHaveLength(2000);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "private\nline",
    "invisible\u200btext",
    "bad\ud800text",
    "x".repeat(2001),
  ])("preserves an invalid latest note %#", async (note) => {
    const { workspace, selection, append, api } = await fixture();
    workspace.noteResearch(selection, note);
    const before = workspace.coordinator.getSnapshot().draft;
    expect(append().appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).not.toHaveBeenCalled();
  });
});
