import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedCatalogSnapshotDto } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { useManagedCompanyNavigation } from "./useManagedCompanyNavigation";

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
    useCallback: (callback: unknown) => callback,
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
  const workspace = new ManagedWorkspace(api, {
    userId: "invented",
    sessionId: "invented",
    getToken: vi.fn(),
    signOut: vi.fn(),
  });
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
  it("resolves a cold link after catalog readiness without source loads and replaces it on Back", async () => {
    direct();
    const f = fixture();
    f.render();
    expect(f.workspace.getSnapshot().companyRoute?.status).toBe(
      "waiting_catalog",
    );
    await f.ready();
    await settle();
    let nav = f.render();
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    expect(f.workspace.getSnapshot().research?.selection).toMatchObject({
      origin: "route",
      cik: null,
      listing: { listingId: "listing-zero" },
    });
    expect(f.api.eodHistory).not.toHaveBeenCalled();
    expect(f.api.annualReport).not.toHaveBeenCalled();
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
  });

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
    nav.section("eod");
    nav.view("watchlist");
    expect(f.workspace.getSnapshot().research?.section).toBe("annual");
    expect(f.workspace.getSnapshot().view).toBe("discover");
    expect(mount.navigate).toHaveBeenCalledTimes(1);
    apply(...mount.navigate.mock.calls[0]!);
    nav = f.render();
    expect(f.workspace.getSnapshot().research?.section).toBe("annual");
    mount.navigate.mockImplementation(apply);
    nav.section("eod");
    f.render();
    expect(f.workspace.getSnapshot().research?.section).toBe("eod");
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
    f.workspace.noteResearch(
      f.workspace.getSnapshot().research!.selection,
      "Unsent",
    );
    nav.view("watchlist");
    f.render();
    expect(mount.entries[mount.cursor]!.search).toBe("");
    expect(mount.entries).toHaveLength(2);
    expect(f.workspace.getSnapshot().view).toBe("watchlist");
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
