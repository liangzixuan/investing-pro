import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedSecCooldownError, type ManagedApi } from "./managed-api";
import { ManagedWorkspace, listingMembership } from "./managed-workspace";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { response as annualResponse } from "../features/research/test-canonical-annual-ui-fixture";
const digest = eodSelection.catalogSnapshotSha256;
const zero: PersonalSecurityMasterSearchResultDto = {
  ...eodSelection.listing,
  cik: eodSelection.cik!,
  matchKind: "current_symbol_exact",
  matchedValue: "ZERO",
};
const other: PersonalSecurityMasterSearchResultDto = {
  ...zero,
  listingId: "listing-other",
  securityId: "security-other",
  shareClassId: "class-other",
  symbol: "OTHER",
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
const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.coordinator.retire();
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function fixture(
  origin: "discover" | "watchlist" = "discover",
  covered = true,
) {
  const payload: MainWatchlistPayload = {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: digest,
    memberships: [listingMembership(zero), listingMembership(other)],
  };
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
      .mockImplementation(() => annualResponse()),
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation((request) =>
        Promise.resolve(eodResponse(request.range)),
      ),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValue(filingsResponse()),
    monetaryAnnouncements: vi.fn(),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn(),
    resolve: vi.fn(),
    save: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn<ManagedApi["search"]>().mockResolvedValue({
      snapshot,
      results: [zero, other],
      totalMatches: 2,
      limitApplied: 25,
      normalizedQuery: "ZERO",
    }),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload }),
  };
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented",
      sessionId: "invented",
      getToken: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
    undefined,
    {
      researchCoverage: createManagedResearchCoverageFixture([
        { listing: zero, cik: zero.cik },
        { listing: other, cik: other.cik },
      ]),
      priceCoverage: covered ? [zero] : [],
    },
  );
  workspaces.push(workspace);
  workspace.setView("discover");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setQuery("ZERO");
  await workspace.search();
  workspace.note(zero.listingId, "Café 東京📈 unchanged draft");
  if (origin === "discover") workspace.openDiscoveryAnnual(zero);
  else
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  return { workspace, api };
}
function visit(workspace: ManagedWorkspace) {
  const current = workspace.getSnapshot().research;
  if (!current) throw new Error("Expected an active invented visit");
  return current;
}
function noAuxiliaryReads(api: ManagedApi) {
  expect(api.status).toHaveBeenCalledOnce();
  expect(api.search).toHaveBeenCalledOnce();
  expect(api.load).toHaveBeenCalledOnce();
  for (const read of [
    api.resolve,
    api.save,
    api.monetaryAnnouncements,
    api.economicCalendar,
  ])
    expect(read).not.toHaveBeenCalled();
}
const sourceReads = {
  annual: "annualReport",
  eod: "eodHistory",
  filings: "recentFilings",
} as const;

describe("explicit exact-visit research source actions", () => {
  it.each(["annual", "eod", "filings"] as const)(
    "loads and cancels %s on a resolved company route while outer navigation is blocked",
    async (section) => {
      const { workspace, api } = await fixture();
      workspace.setNavigationBlocked(true);
      await workspace.setCompanyRoute({
        kind: "company",
        listingId: zero.listingId,
        section: "annual",
      });
      const captured = visit(workspace);
      const draft = workspace.coordinator.getSnapshot().draft;
      expect(workspace.getSnapshot().companyRoute).toMatchObject({
        status: "open",
        section: "annual",
      });
      await workspace.requestResearchSource(captured, section);
      expect(visit(workspace).section).toBe(section);
      expect(visit(workspace).selection).toBe(captured.selection);
      expect(workspace[section].getSnapshot().response).not.toBeNull();
      for (const [name, read] of Object.entries(sourceReads))
        expect(api[read]).toHaveBeenCalledTimes(name === section ? 1 : 0);
      const previous = workspace[section].getSnapshot().response;
      const held = deferred<never>();
      vi.mocked(api[sourceReads[section]]).mockReturnValueOnce(held.promise);
      const current = visit(workspace);
      const pending = workspace.requestResearchSource(current, section);
      expect(api[sourceReads[section]]).toHaveBeenCalledTimes(2);
      workspace.cancelResearchSource(current, section);
      expect(
        vi.mocked(api[sourceReads[section]]).mock.calls[1]![1].aborted,
      ).toBe(true);
      expect(visit(workspace)).toBe(current);
      const retained = workspace[section].getSnapshot();
      expect(retained).toMatchObject({
        response: previous,
        showingPrevious: true,
        running: false,
      });
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace[section].getSnapshot()).toBe(retained);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      noAuxiliaryReads(api);
    },
  );

  it("rejects a source action during resolution of a different company route", async () => {
    const { workspace, api } = await fixture();
    const captured = visit(workspace);
    const held = deferred<never>();
    vi.mocked(api.resolve).mockReturnValueOnce(held.promise);
    workspace.setNavigationBlocked(true);
    const resolving = workspace.setCompanyRoute({
      kind: "company",
      listingId: other.listingId,
      section: "annual",
    });
    expect(workspace.getSnapshot().companyRoute).toMatchObject({
      status: "resolving",
      listingId: other.listingId,
    });
    await workspace.requestResearchSource(captured, "eod");
    workspace.cancelResearchSource(captured, "annual");
    for (const read of Object.values(sourceReads))
      expect(api[read]).not.toHaveBeenCalled();
    held.reject(new TrialApiError("unavailable"));
    await resolving;
  });

  it("rejects a navigation revision during a source action even on a matching open route", async () => {
    const { workspace, api } = await fixture();
    workspace.setNavigationBlocked(true);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: zero.listingId,
      section: "annual",
    });
    let changed = false;
    const unsubscribe = workspace.filings.subscribe(() => {
      if (changed || !workspace.filings.getSnapshot().selection) return;
      changed = true;
      workspace.setNavigationBlocked(true);
    });
    await workspace.requestResearchSource(visit(workspace), "filings");
    unsubscribe();
    expect(changed).toBe(true);
    expect(visit(workspace).section).toBe("annual");
    expect(api.recentFilings).not.toHaveBeenCalled();
    noAuxiliaryReads(api);
  });

  it.each(["annual", "eod", "filings"] as const)(
    "switches synchronously and requests only %s with the captured discovery identity",
    async (section) => {
      const { workspace, api } = await fixture();
      const captured = visit(workspace);
      const draft = workspace.coordinator.getSnapshot().draft;
      for (const read of Object.values(sourceReads))
        expect(api[read]).not.toHaveBeenCalled();
      const request = workspace.requestResearchSource(captured, section);
      expect(visit(workspace)).toMatchObject({
        section,
        selection: captured.selection,
      });
      expect(visit(workspace).selection).toBe(captured.selection);
      expect(workspace[section].getSnapshot().selection).toEqual(
        captured.selection,
      );
      await request;
      for (const [name, read] of Object.entries(sourceReads))
        expect(api[read]).toHaveBeenCalledTimes(name === section ? 1 : 0);
      expect(
        vi.mocked(api[sourceReads[section]]).mock.calls[0]![0],
      ).toMatchObject({
        catalogSnapshotSha256: digest,
        listingId: zero.listingId,
      });
      expect(workspace[section].getSnapshot().response).not.toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      noAuxiliaryReads(api);
    },
  );
  it("keeps watchlist origin/null CIK and a staged one-year range across section switches", async () => {
    const { workspace, api } = await fixture("watchlist");
    workspace.switchToEod();
    const selection = visit(workspace).selection;
    expect(workspace.eod.getSnapshot().selection).not.toBe(selection);
    workspace.eod.selectRange("1y");
    workspace.switchToAnnual();
    await workspace.requestResearchSource(visit(workspace), "eod");
    expect(workspace.eod.getSnapshot()).toMatchObject({
      selectedRange: "1y",
      selection: { origin: "watchlist", cik: null },
      response: {
        range: "1y",
        requestStartedAt: eodResponse("1y").requestStartedAt,
        completedAt: eodResponse("1y").completedAt,
      },
    });
    expect(vi.mocked(api.eodHistory).mock.calls[0]![0].range).toBe("1y");
    expect(visit(workspace).selection).toBe(selection);
    noAuxiliaryReads(api);
  });
  it("opens unsupported Price without a request or clearing loaded Annual evidence", async () => {
    const { workspace, api } = await fixture("discover", false);
    await workspace.requestResearchSource(visit(workspace), "annual");
    const annual = workspace.annual.getSnapshot();
    await workspace.requestResearchSource(visit(workspace), "eod");
    expect(visit(workspace).section).toBe("eod");
    expect(workspace.eod.getSnapshot().available).toBe(false);
    expect(workspace.annual.getSnapshot()).toBe(annual);
    expect(api.eodHistory).not.toHaveBeenCalled();
    noAuxiliaryReads(api);
  });
  it.each(["annual", "eod", "filings"] as const)(
    "refreshes %s once, cancels without switching and fences late results",
    async (section) => {
      const { workspace, api } = await fixture();
      await workspace.requestResearchSource(visit(workspace), section);
      const previous = workspace[section].getSnapshot().response;
      const held = deferred<never>();
      vi.mocked(api[sourceReads[section]]).mockReturnValueOnce(held.promise);
      const captured = visit(workspace);
      const pending = workspace.requestResearchSource(captured, section);
      await workspace.requestResearchSource(captured, section);
      expect(api[sourceReads[section]]).toHaveBeenCalledTimes(2);
      const signal = vi.mocked(api[sourceReads[section]]).mock.calls[1]![1];
      workspace.cancelResearchSource(captured, section);
      expect(signal.aborted).toBe(true);
      expect(visit(workspace)).toBe(captured);
      const retained = workspace[section].getSnapshot();
      expect(retained).toMatchObject({
        response: previous,
        showingPrevious: true,
        running: false,
      });
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(workspace[section].getSnapshot()).toBe(retained);
      expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
      noAuxiliaryReads(api);
    },
  );
  it("rejects a stale section visit while accepting its unchanged selection through the new visit", async () => {
    const { workspace, api } = await fixture();
    const old = visit(workspace);
    workspace.switchToEod();
    const current = visit(workspace);
    expect(current.selection).toBe(old.selection);
    await workspace.requestResearchSource(old, "annual");
    const held = deferred<never>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(held.promise);
    const pending = workspace.requestResearchSource(current, "eod");
    workspace.cancelResearchSource(old, "eod");
    expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(false);
    workspace.cancelResearchSource(current, "eod");
    held.reject(new TrialApiError("aborted"));
    await pending;
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).toHaveBeenCalledOnce();
  });
  it.each([
    "reopened",
    "company",
    "closed",
    "retired",
    "navigation",
    "catalog",
    "membership",
  ] as const)("rejects request and cancel from a %s visit", async (cause) => {
    const { workspace, api } = await fixture("watchlist");
    const captured = visit(workspace);
    if (cause === "reopened")
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
    else if (cause === "company") workspace.openDiscoveryAnnual(other);
    else if (cause === "closed") workspace.closeResearch();
    else if (cause === "retired") workspace.coordinator.retire();
    else if (cause === "navigation") workspace.setNavigationBlocked(true);
    else if (cause === "catalog") {
      vi.mocked(api.status).mockResolvedValueOnce({
        snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
      });
      await workspace.refreshCatalog();
    } else workspace.remove(zero.listingId);
    const state = workspace.getSnapshot();
    await workspace.requestResearchSource(captured, "filings");
    workspace.cancelResearchSource(captured, "annual");
    expect(workspace.getSnapshot()).toBe(state);
    for (const read of Object.values(sourceReads))
      expect(api[read]).not.toHaveBeenCalled();
  });
  it.each(["cancel", "open", "update"] as const)(
    "does not load a replacement company opened by the %s notification",
    async (phase) => {
      const { workspace, api } = await fixture();
      const captured = visit(workspace);
      const held = deferred<never>();
      let pending: Promise<void> | undefined;
      if (phase === "cancel") {
        vi.mocked(api.annualReport).mockReturnValueOnce(held.promise);
        pending = workspace.requestResearchSource(captured, "annual");
      }
      let fired = false;
      const replace = () => {
        if (
          fired ||
          (phase === "cancel" && workspace.annual.getSnapshot().running) ||
          (phase === "open" && !workspace.filings.getSnapshot().selection)
        )
          return;
        fired = true;
        workspace.openDiscoveryAnnual(other);
      };
      const unsubscribe =
        phase === "cancel"
          ? workspace.annual.subscribe(replace)
          : phase === "open"
            ? workspace.filings.subscribe(replace)
            : workspace.subscribe(replace);
      await workspace.requestResearchSource(captured, "filings");
      unsubscribe();
      expect(fired).toBe(true);
      expect(visit(workspace).selection.listing.listingId).toBe(
        other.listingId,
      );
      expect(visit(workspace).section).toBe("annual");
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(workspace.annual.getSnapshot().response).toBeNull();
      if (pending) {
        held.reject(new TrialApiError("aborted"));
        await pending;
      }
    },
  );
  it.each([
    "retire",
    "catalog",
    "navigation round trip",
    "same-company reopen",
    "section",
  ] as const)("fences a reentrant %s during target open", async (change) => {
    const { workspace, api } = await fixture("watchlist");
    const captured = visit(workspace);
    let fired = false;
    const unsubscribe = workspace.filings.subscribe(() => {
      if (fired || !workspace.filings.getSnapshot().selection) return;
      fired = true;
      if (change === "retire") workspace.coordinator.retire();
      else if (change === "catalog")
        workspace.coordinator.replaceDraft({
          ...workspace.coordinator.getSnapshot().draft!,
          snapshotSha256: `sha256:${"b".repeat(64)}`,
        });
      else if (change === "navigation round trip") {
        workspace.setNavigationBlocked(true);
        workspace.setNavigationBlocked(false);
      } else if (change === "same-company reopen")
        workspace.openWatchlistAnnual(
          workspace.coordinator.getSnapshot().draft!.memberships[0]!,
        );
      else workspace.switchToEod();
    });
    await workspace.requestResearchSource(captured, "filings");
    unsubscribe();
    expect(fired).toBe(true);
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(workspace.getSnapshot().research?.section).not.toBe("filings");
  });
  it.each(["origin", "cik", "shareClassId", "catalog"] as const)(
    "rejects a mismatched target model %s after the workspace update",
    async (field) => {
      const { workspace, api } = await fixture();
      const captured = visit(workspace);
      let fired = false;
      const unsubscribe = workspace.subscribe(() => {
        if (fired || workspace.getSnapshot().research?.section !== "filings")
          return;
        fired = true;
        const selection = captured.selection;
        workspace.filings.open({
          ...selection,
          ...(field === "origin"
            ? { origin: "watchlist" }
            : field === "cik"
              ? { cik: null }
              : field === "catalog"
                ? { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const }
                : {
                    listing: {
                      ...selection.listing,
                      shareClassId: "other-class",
                    },
                  }),
        });
      });
      await workspace.requestResearchSource(captured, "filings");
      unsubscribe();
      workspace.cancelResearchSource(visit(workspace), "filings");
      expect(fired).toBe(true);
      expect(api.recentFilings).not.toHaveBeenCalled();
    },
  );

  it("does not request a same-identity model reopened by the section update listener", async () => {
    const { workspace, api } = await fixture();
    const captured = visit(workspace);
    let fired = false;
    const unsubscribe = workspace.subscribe(() => {
      if (fired || workspace.getSnapshot().research?.section !== "filings")
        return;
      fired = true;
      const prior = workspace.filings.getSnapshot().selection;
      workspace.filings.close();
      workspace.filings.open(captured.selection);
      expect(workspace.filings.getSnapshot().selection).toEqual(prior);
      expect(workspace.filings.getSnapshot().selection).not.toBe(prior);
    });
    await workspace.requestResearchSource(captured, "filings");
    unsubscribe();
    expect(fired).toBe(true);
    expect(visit(workspace).selection).toBe(captured.selection);
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(workspace.filings.getSnapshot().response).toBeNull();
  });

  it("cancels only the requested exact model without switching the selected section", async () => {
    const { workspace, api } = await fixture();
    workspace.switchToEod();
    workspace.switchToAnnual();
    const captured = visit(workspace);
    const priceRead = deferred<never>();
    const annualRead = deferred<never>();
    vi.mocked(api.eodHistory).mockReturnValueOnce(priceRead.promise);
    vi.mocked(api.annualReport).mockReturnValueOnce(annualRead.promise);
    const price = workspace.eod.load();
    const annual = workspace.requestResearchSource(captured, "annual");
    workspace.cancelResearchSource(captured, "eod");
    expect(visit(workspace)).toBe(captured);
    expect(visit(workspace).section).toBe("annual");
    expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(true);
    expect(vi.mocked(api.annualReport).mock.calls[0]![1].aborted).toBe(false);
    workspace.cancelResearchSource(captured, "annual");
    priceRead.reject(new TrialApiError("aborted"));
    annualRead.reject(new TrialApiError("aborted"));
    await Promise.all([price, annual]);
    noAuxiliaryReads(api);
  });

  it("cannot cancel a directly replaced model with a different exact identity", async () => {
    const { workspace, api } = await fixture();
    const captured = visit(workspace);
    workspace.filings.open({
      ...captured.selection,
      listing: other,
      cik: other.cik,
    });
    const held = deferred<never>();
    vi.mocked(api.recentFilings).mockReturnValueOnce(held.promise);
    const reading = workspace.filings.load();
    const signal = vi.mocked(api.recentFilings).mock.calls[0]![1];
    workspace.cancelResearchSource(captured, "filings");
    expect(signal.aborted).toBe(false);
    expect(visit(workspace)).toBe(captured);
    workspace.closeResearch();
    held.reject(new TrialApiError("aborted"));
    await reading;
  });
  it("keeps shared SEC cooldown admission with no delayed or sibling request", async () => {
    const { workspace, api } = await fixture();
    vi.useFakeTimers();
    const nextAllowedAt = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(api.annualReport).mockRejectedValueOnce(
      new ManagedSecCooldownError(nextAllowedAt),
    );
    await workspace.requestResearchSource(visit(workspace), "annual");
    await workspace.requestResearchSource(visit(workspace), "filings");
    expect(workspace.filings.getSnapshot().message).toContain(nextAllowedAt);
    expect(api.recentFilings).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(api.recentFilings).not.toHaveBeenCalled();
    await workspace.requestResearchSource(visit(workspace), "filings");
    expect(api.recentFilings).toHaveBeenCalledOnce();
    expect(api.annualReport).toHaveBeenCalledOnce();
    noAuxiliaryReads(api);
  });
  it("leaves transient retention and malformed clearing to the source model", async () => {
    const { workspace, api } = await fixture();
    await workspace.requestResearchSource(visit(workspace), "eod");
    const previous = workspace.eod.getSnapshot().response;
    vi.mocked(api.eodHistory).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.requestResearchSource(visit(workspace), "eod");
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: previous,
      showingPrevious: true,
    });
    vi.mocked(api.eodHistory).mockResolvedValueOnce({
      ...eodResponse(),
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
    });
    await workspace.requestResearchSource(visit(workspace), "eod");
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
      error: true,
    });
    expect(api.eodHistory).toHaveBeenCalledTimes(3);
    noAuxiliaryReads(api);
  });
});
