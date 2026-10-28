import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedCatalogSnapshotDto } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { useManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { TrialApiError } from "./api";
import { response as annualResponse } from "../features/research/test-canonical-annual-ui-fixture";

// Exercise the hook's actual transitions against a real workspace. The router
// harness supplies PUSH/REPLACE/POP and preserves the same hook slots per mount.
type Navigate = (
  to: string | number,
  options?: { replace?: boolean; state?: unknown },
) => void;
type Entry = { pathname: string; search: string; key: string; state: unknown };
const mount = vi.hoisted(() => ({
  slots: [] as unknown[],
  index: 0,
  layouts: [] as Array<() => unknown>,
  effects: [] as Array<() => unknown>,
  entries: [{ pathname: "/", search: "", key: "0", state: null }] as Entry[],
  cursor: 0,
  sequence: 0,
  action: "POP",
  navigate: vi.fn<Navigate>(),
}));
vi.mock("react", () => {
  const effect = (
    queue: Array<() => unknown>,
    callback: () => unknown,
    deps: unknown[],
  ) => {
    const index = mount.index++;
    const prior = mount.slots[index] as unknown[] | undefined;
    if (!prior || deps.some((value, i) => value !== prior[i]))
      queue.push(callback);
    mount.slots[index] = deps;
  };
  return {
    useRef: (value: unknown) => {
      const index = mount.index++;
      return (mount.slots[index] ??= { current: value });
    },
    useState: (initial: unknown) => {
      const index = mount.index++;
      if (!(index in mount.slots))
        mount.slots[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        mount.slots[index],
        (value: unknown) => {
          mount.slots[index] =
            typeof value === "function"
              ? (value as (previous: unknown) => unknown)(mount.slots[index])
              : value;
        },
      ];
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = mount.index++;
      const previous = mount.slots[index] as
        { callback: unknown; deps: unknown[] } | undefined;
      if (!previous || deps.some((value, i) => value !== previous.deps[i]))
        mount.slots[index] = { callback, deps };
      return (mount.slots[index] as { callback: unknown }).callback;
    },
    useLayoutEffect: (callback: () => unknown, deps: unknown[]) =>
      effect(mount.layouts, callback, deps),
    useEffect: (callback: () => unknown, deps: unknown[]) =>
      effect(mount.effects, callback, deps),
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
      getSnapshot(),
  };
});
vi.mock("react-router", () => ({
  NavigationType: { Pop: "POP" },
  useLocation: () => mount.entries[mount.cursor],
  useNavigate: () => mount.navigate,
  useNavigationType: () => mount.action,
}));
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented",
  catalogVersion: "invented",
  acquiredAt: "2026-09-20T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented",
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
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
beforeEach(() => {
  mount.slots = [];
  mount.index = 0;
  mount.layouts = [];
  mount.effects = [];
  mount.entries = [{ pathname: "/", search: "", key: "0", state: null }];
  mount.cursor = 0;
  mount.sequence = 0;
  mount.action = "POP";
  mount.navigate
    .mockReset()
    .mockImplementation(
      (
        to: string | number,
        options?: { replace?: boolean; state?: unknown },
      ) => {
        if (typeof to === "number") {
          mount.cursor += to;
          mount.action = "POP";
          return;
        }
        const url = new URL(to, "https://invented.invalid");
        const entry = {
          pathname: url.pathname,
          search: url.search,
          key: String(++mount.sequence),
          state: options?.state ?? null,
        };
        if (options?.replace) {
          mount.entries[mount.cursor] = entry;
          mount.action = "REPLACE";
        } else {
          mount.entries.splice(mount.cursor + 1);
          mount.entries.push(entry);
          mount.cursor++;
          mount.action = "PUSH";
        }
      },
    );
});
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function fixture() {
  const api: ManagedApi = {
    cpiHeadlines: vi
      .fn<ManagedApi["cpiHeadlines"]>()
      .mockRejectedValue(new Error("Unexpected CPI headlines read")),
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
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockRejectedValue(new Error("Unexpected announcements read")),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue({
      version: 1,
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot.snapshotSha256,
        memberships: [
          { ...eodSelection.listing, note: "Original invented note" },
          {
            ...eodSelection.listing,
            listingId: "listing-other",
            issuerId: "issuer-other",
            issuerName: "Other invented company",
            securityId: "security-other",
            shareClassId: "class-other",
            symbol: "OTHER",
            note: "Other invented note",
          },
        ],
      },
    }),
    save: vi.fn(),
    search: vi.fn(),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>(),
    annualReport: vi.fn(),
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse()),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            listingId === eodSelection.listing.listingId
              ? eodSelection.listing
              : null,
        })),
      }),
    ),
  };
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented",
      sessionId: "invented",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    undefined,
    {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: [eodSelection.listing],
    },
  );
  workspace.setView("discover");
  const render = () => {
    mount.index = 0;
    const navigation = useManagedCompanyNavigation(workspace);
    while (mount.layouts.length) mount.layouts.shift()!();
    while (mount.effects.length) mount.effects.shift()!();
    return navigation;
  };
  return {
    api,
    workspace,
    render,
    async ready() {
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
    },
  };
}
function direct(search = "?company=listing-zero&section=price") {
  mount.entries[0] = { pathname: "/", search, key: "0", state: null };
}

describe("managed company URL navigation", () => {
  it("routes the rendered Interim section to its real model without a source read and keeps the authored draft", async () => {
    const f = fixture();
    await f.ready();
    f.workspace.setView("watchlist");
    let nav = f.render();
    const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    nav.open(() => f.workspace.openWatchlistAnnual(member));
    nav = f.render();
    const selection = f.workspace.getSnapshot().research!.selection;
    f.workspace.noteResearch(
      selection,
      "Thèse café 📈 retained through Interim",
    );
    const draft = f.workspace.coordinator.getSnapshot().draft;
    nav.section("interim");
    expect(f.workspace.getSnapshot().research?.section).toBe("interim");
    expect(f.workspace.interim.getSnapshot().selection).toStrictEqual(
      selection,
    );
    expect(mount.entries[mount.cursor]?.search).toBe(
      "?company=listing-zero&section=interim",
    );
    expect(nav.isPending()).toBe(true);
    nav = f.render();
    expect(nav.isPending()).toBe(false);
    expect(f.workspace.getSnapshot().companyRoute?.section).toBe("interim");
    expect(f.workspace.interim.getSnapshot()).toMatchObject({
      running: false,
      response: null,
    });
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    for (const read of [
      f.api.interimReport,
      f.api.annualReport,
      f.api.eodHistory,
      f.api.recentFilings,
    ])
      expect(read).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    nav.back();
    f.render();
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(mount.navigate).toHaveBeenLastCalledWith(-1);
  });

  it("loads explicit company sources while the applied URL keeps outer workspace navigation blocked", async () => {
    const f = fixture();
    await f.ready();
    f.workspace.setView("watchlist");
    let navigation = f.render();
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    navigation.open(() =>
      f.workspace.openWatchlistAnnual(draft.memberships[0]!),
    );
    navigation = f.render();
    expect(f.workspace.getSnapshot().companyRoute?.status).toBe("open");
    expect(f.workspace.annualComparison.getSnapshot().active).toBe(false);
    vi.mocked(f.api.annualReport).mockResolvedValueOnce(await annualResponse());
    await f.workspace.requestResearchSource(
      f.workspace.getSnapshot().research!,
      "annual",
    );
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(f.workspace.annual.getSnapshot().response).not.toBeNull();
    const price = f.workspace.requestResearchSource(
      f.workspace.getSnapshot().research!,
      "eod",
    );
    navigation.section("eod");
    await price;
    f.render();
    expect(f.workspace.getSnapshot().companyRoute?.section).toBe("eod");
    expect(f.workspace.eod.getSnapshot().response).not.toBeNull();
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.workspace.annualComparison.getSnapshot().active).toBe(false);
  });

  it("cancels an explicit source on an applied company URL and refuses its late completion", async () => {
    const f = fixture();
    await f.ready();
    const navigation = f.render();
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    navigation.open(() =>
      f.workspace.openWatchlistAnnual(draft.memberships[0]!),
    );
    f.render();
    const visit = f.workspace.getSnapshot().research!;
    let complete!: (
      value: Awaited<ReturnType<ManagedApi["annualReport"]>>,
    ) => void;
    vi.mocked(f.api.annualReport).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const reading = f.workspace.requestResearchSource(visit, "annual");
    const signal = vi.mocked(f.api.annualReport).mock.calls[0]![1];
    expect(signal.aborted).toBe(false);
    f.workspace.cancelResearchSource(visit, "annual");
    expect(signal.aborted).toBe(true);
    complete(await annualResponse());
    await reading;
    expect(f.workspace.annual.getSnapshot().response).toBeNull();
    expect(f.api.annualReport).toHaveBeenCalledOnce();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
  });

  it.each([
    "?company=listing-zero&section=price",
    "?company=listing-zero&section=invalid",
  ])(
    "keeps announcements inactive on a cold route and pending return (%s)",
    async (search) => {
      direct(search);
      const f = fixture();
      f.workspace.setView("markets");
      const nav = f.render();
      await f.workspace.announcements.load();
      expect(f.api.monetaryAnnouncements).not.toHaveBeenCalled();
      mount.navigate.mockImplementation(() => undefined);
      nav.back();
      await f.workspace.announcements.load();
      expect(f.api.monetaryAnnouncements).not.toHaveBeenCalled();
      expect(nav.hasCompanyRoute()).toBe(true);
      mount.entries[0] = {
        pathname: "/",
        search: "",
        key: "returned",
        state: null,
      };
      f.render();
      expect(f.api.monetaryAnnouncements).not.toHaveBeenCalled();
      vi.mocked(f.api.monetaryAnnouncements).mockResolvedValue(
        fedAnnouncementsFixture(),
      );
      await f.workspace.announcements.load();
      expect(f.api.monetaryAnnouncements).toHaveBeenCalledOnce();
    },
  );
  it("cancels a refresh on company entry and fences late auth while preserving feed and unsaved note", async () => {
    const f = fixture();
    await f.ready();
    f.workspace.setView("markets");
    let nav = f.render();
    const feed = fedAnnouncementsFixture();
    vi.mocked(f.api.monetaryAnnouncements).mockResolvedValueOnce(feed);
    await f.workspace.announcements.load();
    const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    f.workspace.note(member.listingId, "Unsent announcement journey note");
    const draft = f.workspace.coordinator.getSnapshot().draft;
    let fail!: (error: unknown) => void;
    vi.mocked(f.api.monetaryAnnouncements).mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const pending = f.workspace.announcements.load();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    expect(
      vi.mocked(f.api.monetaryAnnouncements).mock.calls[1]![0].aborted,
    ).toBe(true);
    fail(new TrialApiError("unauthenticated"));
    await pending;
    expect(f.workspace.coordinator.getSnapshot().phase).not.toBe("retired");
    expect(f.workspace.announcements.getSnapshot()).toMatchObject({
      announcements: feed,
      busy: false,
      showingPrevious: true,
    });
    nav = f.render();
    nav.back();
    f.render();
    expect(f.workspace.announcements.getSnapshot().announcements).toBe(feed);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.api.monetaryAnnouncements).toHaveBeenCalledTimes(2);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.economicCalendar).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    f.workspace.coordinator.retire();
    expect(f.workspace.announcements.getSnapshot().announcements).toBeNull();
  });
  it.each(["price", "annual", "interim", "filings"])(
    "resolves a cold %s link after catalog readiness without source loads and replaces it on Back",
    async (section) => {
      direct(`?company=listing-zero&section=${section}`);
      const f = fixture();
      f.render();
      expect(f.workspace.getSnapshot().companyRoute?.status).toBe(
        "waiting_catalog",
      );
      await f.ready();
      await settle();
      let nav = f.render();
      expect(f.api.resolve).toHaveBeenCalledTimes(1);
      expect(f.workspace.getSnapshot().research?.section).toBe(
        section === "price" ? "eod" : section,
      );
      expect(f.api.interimReport).not.toHaveBeenCalled();
      expect(f.workspace.getSnapshot().research?.selection).toMatchObject({
        origin: "route",
        cik: null,
        listing: { listingId: "listing-zero" },
      });
      expect(f.api.eodHistory).not.toHaveBeenCalled();
      expect(f.api.annualReport).not.toHaveBeenCalled();
      expect(f.api.recentFilings).not.toHaveBeenCalled();
      expect(f.api.save).not.toHaveBeenCalled();
      nav.back();
      f.render();
      expect(mount.navigate).toHaveBeenLastCalledWith("/", {
        replace: true,
        state: null,
      });
      expect(mount.cursor).toBe(0);
      expect(mount.entries).toHaveLength(1);
      expect(f.workspace.getSnapshot().view).toBe("markets");
      expect(f.workspace.getSnapshot().research).toBeNull();
      nav = f.render();
      expect(nav.returnFocus).toBe(1);
    },
  );

  it("pushes an in-app visit once, replaces section changes, and keeps loaded results and the draft", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    nav.open(() => f.workspace.openWatchlistEod(member));
    const selection = f.workspace.getSnapshot().research!.selection;
    nav = f.render();
    await f.workspace.eod.load();
    const response = f.workspace.eod.getSnapshot().response;
    f.workspace.noteResearch(selection, "Unsent invented note");
    nav.section("annual");
    nav = f.render();
    nav.section("filings");
    nav = f.render();
    expect(f.workspace.getSnapshot().research?.section).toBe("filings");
    expect(f.api.recentFilings).not.toHaveBeenCalled();
    nav.section("eod");
    nav = f.render();
    expect(mount.entries).toHaveLength(2);
    expect(mount.cursor).toBe(1);
    expect(f.workspace.getSnapshot().research?.selection).toBe(selection);
    expect(f.workspace.eod.getSnapshot().response).toBe(response);
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.eodHistory).toHaveBeenCalledTimes(1);
    expect(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Unsent invented note");
    nav.back();
    f.render();
    expect(mount.navigate).toHaveBeenLastCalledWith(-1);
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.workspace.getSnapshot().view).toBe("discover");
    mount.navigate(1);
    f.render();
    await settle();
    f.render();
    expect(f.workspace.getSnapshot().research?.selection.origin).toBe("route");
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    expect(f.api.eodHistory).toHaveBeenCalledTimes(1);
    expect(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Unsent invented note");
  });

  it.each(["annual", "interim", "eod", "filings"] as const)(
    "replaces companies in %s and returns once to the original watchlist",
    async (section) => {
      const f = fixture();
      await f.ready();
      f.workspace.setView("watchlist");
      let nav = f.render();
      const members = f.workspace.coordinator.getSnapshot().draft!.memberships;
      nav.open(() => f.workspace.openWatchlistAnnual(members[0]!));
      nav = f.render();
      nav.section(section);
      nav = f.render();
      const origin = mount.entries[1]!.state;
      const first = f.workspace.getSnapshot().research!;
      f.workspace.noteResearch(
        first.selection,
        "First draft kept through visits",
      );
      const currentOther =
        f.workspace.coordinator.getSnapshot().draft!.memberships[1]!;
      nav.open(() => f.workspace.openResearchCompany(first, currentOther));
      nav = f.render();
      const second = f.workspace.getSnapshot().research!;
      expect(second.selection.listing.listingId).toBe("listing-other");
      expect(second.section).toBe(section);
      expect(mount.entries).toHaveLength(2);
      expect(mount.entries[1]!.state).toEqual(origin);
      expect(mount.action).toBe("REPLACE");
      f.workspace.noteResearch(
        second.selection,
        "Second draft kept through visits",
      );
      const currentFirst =
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      nav.open(() => f.workspace.openResearchCompany(second, currentFirst));
      nav = f.render();
      expect(
        f.workspace.getSnapshot().research!.selection.listing.listingId,
      ).toBe(currentFirst.listingId);
      expect(mount.entries).toHaveLength(2);
      expect(mount.entries[1]!.state).toEqual(origin);
      nav.back();
      f.render();
      expect(mount.cursor).toBe(0);
      expect(mount.navigate).toHaveBeenLastCalledWith(-1);
      expect(f.workspace.getSnapshot().view).toBe("watchlist");
      expect(f.workspace.getSnapshot().research).toBeNull();
      expect(
        f.workspace.coordinator
          .getSnapshot()
          .draft!.memberships.map((m) => m.note),
      ).toEqual([
        "First draft kept through visits",
        "Second draft kept through visits",
      ]);
      for (const read of [
        f.api.eodHistory,
        f.api.annualReport,
        f.api.interimReport,
        f.api.recentFilings,
        f.api.resolve,
        f.api.save,
      ])
        expect(read).not.toHaveBeenCalled();
    },
  );

  it("keeps the direct-link fallback when choosing another watchlist company", async () => {
    direct("?company=listing-zero&section=annual");
    const f = fixture();
    await f.ready();
    f.render();
    await settle();
    let nav = f.render();
    const visit = f.workspace.getSnapshot().research!;
    const other = f.workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    nav.open(() => f.workspace.openResearchCompany(visit, other));
    nav = f.render();
    expect(
      f.workspace.getSnapshot().research!.selection.listing.listingId,
    ).toBe("listing-other");
    expect(mount.entries).toHaveLength(1);
    expect(mount.entries[0]!.state).toBeNull();
    expect(f.api.resolve).toHaveBeenCalledOnce();
    nav.back();
    f.render();
    expect(mount.entries[0]!.search).toBe("");
    expect(f.workspace.getSnapshot().view).toBe("markets");
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it.each([
    "?company=listing-zero&section=price",
    "?company=listing-zero&section=bad",
  ])(
    "does not invent a history parent when replacing a direct link (%s)",
    async (search) => {
      direct(search);
      const f = fixture();
      await f.ready();
      f.render();
      await settle();
      let nav = f.render();
      nav.open(() =>
        f.workspace.openWatchlistAnnual(
          f.workspace.coordinator.getSnapshot().draft!.memberships[1]!,
        ),
      );
      nav = f.render();
      expect(mount.entries).toHaveLength(1);
      expect(mount.entries[0]!.state).toBeNull();
      expect(mount.entries[0]!.search).toBe(
        "?company=listing-other&section=annual",
      );
      nav.back();
      f.render();
      expect(
        mount.navigate.mock.calls.every(
          ([target]) => typeof target !== "number",
        ),
      ).toBe(true);
      expect(mount.entries[0]!.search).toBe("");
      expect(f.workspace.getSnapshot().view).toBe("markets");
    },
  );

  it("handles repeated Back while the first POP is pending with only one history step", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    nav = f.render();
    mount.navigate.mockClear().mockImplementation(() => undefined);
    nav.back();
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(nav.hasCompanyRoute()).toBe(true);
    nav.back();
    expect(mount.navigate).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it("rejects overlapping opens before mutating the workspace or pushing a second entry", async () => {
    const f = fixture();
    await f.ready();
    const nav = f.render();
    const members = f.workspace.coordinator.getSnapshot().draft!.memberships;
    const apply = mount.navigate.getMockImplementation()!;
    mount.navigate.mockImplementation(() => undefined);
    nav.open(() => f.workspace.openWatchlistEod(members[0]!));
    const second = vi.fn(() => f.workspace.openWatchlistAnnual(members[1]!));
    nav.open(second);
    expect(second).not.toHaveBeenCalled();
    expect(
      f.workspace.getSnapshot().research?.selection.listing.listingId,
    ).toBe("listing-zero");
    expect(mount.navigate).toHaveBeenCalledTimes(1);
    apply(...mount.navigate.mock.calls[0]!);
    f.render();
    expect(mount.entries).toHaveLength(2);
    expect(
      f.workspace.getSnapshot().research?.selection.listing.listingId,
    ).toBe("listing-zero");
    expect(f.api.eodHistory).not.toHaveBeenCalled();
  });

  it("does not let a second section or view action change the model before the first replacement applies", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    nav = f.render();
    const apply = mount.navigate.getMockImplementation()!;
    mount.navigate.mockClear().mockImplementation(() => undefined);
    nav.section("annual");
    expect(nav.isPending()).toBe(true);
    nav = f.render();
    expect(nav.pending).toBe(true);
    nav.section("eod");
    expect(nav.view("watchlist")).toBe(false);
    nav.back();
    const open = vi.fn();
    nav.open(open);
    expect(open).not.toHaveBeenCalled();
    expect(f.workspace.getSnapshot().research?.section).toBe("annual");
    expect(f.workspace.getSnapshot().view).toBe("discover");
    expect(mount.navigate).toHaveBeenCalledTimes(1);
    apply(...mount.navigate.mock.calls[0]!);
    nav = f.render();
    expect(nav.isPending()).toBe(false);
    nav = f.render();
    expect(nav.pending).toBe(false);
    expect(f.workspace.getSnapshot().research?.section).toBe("annual");
    mount.navigate.mockImplementation(apply);
    nav.section("eod");
    f.render();
    expect(f.workspace.getSnapshot().research?.section).toBe("eod");
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
  });

  it("keeps same-route view and section actions ready without creating navigation", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    expect(nav.view("watchlist")).toBe(true);
    expect(nav.isPending()).toBe(false);
    nav = f.render();
    expect(nav.pending).toBe(false);
    expect(mount.navigate).not.toHaveBeenCalled();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    f.render();
    nav = f.render();
    mount.navigate.mockClear();
    nav.section("eod");
    expect(nav.isPending()).toBe(false);
    expect(f.render().pending).toBe(false);
    expect(mount.navigate).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("cancels the departed read immediately while the replacement is held and fences its late response", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    nav = f.render();
    f.workspace.noteResearch(
      f.workspace.getSnapshot().research!.selection,
      "Keep this draft",
    );
    const draft = f.workspace.coordinator.getSnapshot().draft;
    let complete!: (value: ReturnType<typeof eodResponse>) => void;
    vi.mocked(f.api.eodHistory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const loading = f.workspace.eod.load();
    const signal = vi.mocked(f.api.eodHistory).mock.calls[0]![1];
    mount.navigate.mockClear().mockImplementation(() => undefined);
    nav.section("annual");
    expect(signal.aborted).toBe(true);
    expect(nav.isPending()).toBe(true);
    expect(f.render().pending).toBe(true);
    complete(eodResponse());
    await loading;
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    expect(f.workspace.getSnapshot().research?.section).toBe("annual");
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("keeps a held retirement redirect pending until its location commits without reopening research", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    f.render();
    f.render();
    const apply = mount.navigate.getMockImplementation()!;
    mount.navigate.mockClear().mockImplementation(() => undefined);
    f.workspace.sessionOwner.retire();
    f.render();
    nav = f.render();
    expect(nav.pending).toBe(true);
    expect(nav.isPending()).toBe(true);
    const open = vi.fn();
    nav.open(open);
    nav.section("annual");
    expect(nav.view("watchlist")).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(mount.navigate).toHaveBeenCalledExactlyOnceWith("/", {
      replace: true,
      state: null,
    });
    apply(...mount.navigate.mock.calls[0]!);
    f.render();
    nav = f.render();
    expect(nav.pending).toBe(false);
    expect(nav.isPending()).toBe(false);
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
  });

  it("closes URL research when reviewing My Watchlist without saving", async () => {
    const f = fixture();
    await f.ready();
    let nav = f.render();
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    nav = f.render();
    const companySearch = mount.entries[mount.cursor]!.search;
    f.workspace.noteResearch(
      f.workspace.getSnapshot().research!.selection,
      "Unsent",
    );
    nav.view("watchlist");
    nav = f.render();
    expect(mount.entries[mount.cursor]!.search).toBe("");
    expect(mount.entries).toHaveLength(2);
    expect(f.workspace.getSnapshot().view).toBe("watchlist");
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Unsent");

    expect(mount.cursor).toBe(1);
    nav.open(() =>
      f.workspace.openWatchlistEod(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    nav = f.render();
    expect(mount.entries.map((entry) => entry.search)).toEqual([
      "",
      "",
      companySearch,
    ]);
    expect(mount.cursor).toBe(2);
    nav.back();
    f.render();
    expect(mount.cursor).toBe(1);
    expect(mount.entries).toHaveLength(3);
    expect(mount.entries[mount.cursor]!.search).toBe("");
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Unsent");
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("leaves an unknown listing recoverable without automatic retry", async () => {
    direct("?company=listing-missing&section=annual");
    const f = fixture();
    await f.ready();
    f.render();
    await settle();
    f.render();
    f.render();
    expect(f.workspace.getSnapshot().companyRoute?.status).toBe("unavailable");
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    expect(mount.navigate).not.toHaveBeenCalled();
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.eodHistory).not.toHaveBeenCalled();
  });

  it("rejects malformed and non-root links without any resolve", async () => {
    direct("?company=listing-zero&section=bad");
    const f = fixture();
    await f.ready();
    const nav = f.render();
    expect(nav.invalid).toBe(true);
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.workspace.getSnapshot().research).toBeNull();
  });

  it("clears the URL after catalog refusal without reapplying the old request", async () => {
    direct();
    const f = fixture();
    await f.ready();
    vi.mocked(f.api.resolve).mockRejectedValue(
      new ManagedCatalogChangedError(),
    );
    f.render();
    await settle();
    f.render();
    f.render();
    expect(mount.entries[mount.cursor]!.search).toBe("");
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    expect(f.api.eodHistory).not.toHaveBeenCalled();
  });

  it("clears a retired session URL and ignores its later history reentry", async () => {
    direct();
    const f = fixture();
    await f.ready();
    f.render();
    await settle();
    f.render();
    f.workspace.coordinator.retire();
    f.render();
    f.render();
    expect(mount.entries[mount.cursor]!.search).toBe("");
    expect(f.workspace.getSnapshot().research).toBeNull();
    mount.navigate("/?company=listing-zero&section=price");
    f.render();
    f.render();
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
  });
});

describe("Annual comparison router boundaries", () => {
  it("keeps the pair inactive throughout a pending Back and restores it without an automatic read", async () => {
    const f = fixture();
    await f.ready();
    f.workspace.setView("watchlist");
    let navigation = f.render();
    const comparison = f.workspace.annualComparison;
    const member = comparison.getSnapshot().memberships[0]!;
    comparison.select("left", comparison.getSnapshot(), member);
    navigation.open(() =>
      f.workspace.openWatchlistAnnual(
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      ),
    );
    navigation = f.render();
    expect(comparison.getSnapshot().active).toBe(false);
    const apply = mount.navigate.getMockImplementation()!;
    mount.navigate.mockImplementation(() => undefined);
    navigation.back();
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(comparison.getSnapshot().active).toBe(false);
    await comparison.load("left", member);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    apply(-1);
    f.render();
    expect(comparison.getSnapshot().active).toBe(true);
    expect(comparison.getSnapshot().left.selected).toBe(member);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
  });

  it("blocks a retained watchlist pair on an invalid URL before the view changes", async () => {
    const f = fixture();
    await f.ready();
    f.workspace.setView("watchlist");
    f.render();
    const comparison = f.workspace.annualComparison;
    const member = comparison.getSnapshot().memberships[0]!;
    comparison.select("left", comparison.getSnapshot(), member);
    mount.navigate("/?company=listing-zero&section=invalid");
    const navigation = f.render();
    expect(navigation.invalid).toBe(true);
    expect(f.workspace.getSnapshot().view).toBe("watchlist");
    expect(comparison.getSnapshot().active).toBe(false);
    await comparison.load("left", member);
    comparison.select("left", comparison.getSnapshot(), null);
    expect(comparison.getSnapshot().left.selected).toBe(member);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
  });
});

it("returns to the exact Portfolio draft without Watchlist additions or source reads, and blocks raw-form navigation", async () => {
  const f = fixture();
  await f.ready();
  f.api.loadPortfolio = vi
    .fn<ManagedApi["loadPortfolio"]>()
    .mockResolvedValue({ version: 0, payload: null });
  await f.workspace.portfolio.coordinator.load();
  f.api.loadFollowups = vi.fn<ManagedApi["loadFollowups"]>().mockResolvedValue({
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  });
  await f.workspace.followups.coordinator.load();
  f.workspace.note(eodSelection.listing.listingId, "Raw Watchlist draft 财报");
  f.workspace.followups.add(
    { ...eodSelection.listing, note: "" },
    "2026-10-30",
  );
  const followups = f.workspace.followups.coordinator.getSnapshot().draft;
  f.workspace.setView("portfolio");
  f.workspace.portfolio.start("2026-10-01", "1000.00");
  await f.workspace.portfolio.register(eodSelection.listing);
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  const watchlist = f.workspace.coordinator.getSnapshot();
  let navigation = f.render();
  const opener = vi.fn(() =>
    f.workspace.openPortfolioResearch(draft, draft.ledger!.identities[0]!),
  );
  f.workspace.portfolio.setPendingEditor(draft, true);
  navigation.open(opener);
  expect(navigation.view("discover")).toBe(false);
  navigation.back();
  expect(opener).not.toHaveBeenCalled();
  expect(mount.navigate).not.toHaveBeenCalled();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(draft);
  f.workspace.portfolio.setPendingEditor(draft, false);
  navigation.open(opener);
  navigation = f.render();
  expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
    "portfolio",
  );
  expect(mount.entries[mount.cursor]!.state).toMatchObject({
    companyReturn: { view: "portfolio" },
  });
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  navigation.back();
  navigation = f.render();
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(navigation.returnFocus).toBe(0);
  expect(f.render().returnFocus).toBe(1);
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).toHaveBeenCalledOnce();
  expect(f.api.save).not.toHaveBeenCalled();
});
