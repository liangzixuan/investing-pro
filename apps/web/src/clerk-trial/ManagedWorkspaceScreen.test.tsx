import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeMainWatchlistPayload,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWorkspaceScreen } from "./ManagedWorkspaceScreen";
import { TrialApiError } from "./api";
import { TrialFrame } from "./TrialFrame";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import type { AndroidBackAdapter } from "../mobile/android-back";
import { response as annualResponse } from "../features/research/sec-annual-evidence-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedResearchNote } from "./ManagedResearchNote";

// Run the screen's actual listener effect explicitly; model and binder stay real.
const mounted = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  refs: [] as Array<{ current: unknown }>,
  cleanups: [] as Array<() => void>,
  direct: false,
  refIndex: 0,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useEffect: (effect: () => (() => void) | void) =>
      mounted.effects.push(effect),
    useRef: (value: unknown) => {
      if (mounted.direct) {
        const index = mounted.refIndex++;
        return (mounted.refs[index] ??= { current: value });
      }
      const ref = actual.useRef(value);
      mounted.refs.push(ref);
      return ref;
    },
    useState: (value: unknown) =>
      mounted.direct ? [value, vi.fn()] : actual.useState(value),
    useCallback: (callback: () => void, dependencies: React.DependencyList) =>
      mounted.direct ? callback : actual.useCallback(callback, dependencies),
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
      getServerSnapshot: () => unknown,
    ) =>
      mounted.direct
        ? getSnapshot()
        : actual.useSyncExternalStore(
            subscribe,
            getSnapshot,
            getServerSnapshot,
          ),
  };
});
beforeEach(() => {
  mounted.effects.length = 0;
  mounted.refs.length = 0;
  mounted.cleanups.length = 0;
  mounted.direct = false;
  mounted.refIndex = 0;
});
afterEach(() => {
  for (const cleanup of mounted.cleanups) cleanup();
  vi.unstubAllGlobals();
  mounted.direct = false;
});

function nativeBackFixture() {
  let listener!: (event: { canGoBack: boolean }) => void;
  let registered!: (handle: { remove: () => Promise<void> }) => void;
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  const addListener = vi
    .fn<AndroidBackAdapter["addListener"]>()
    .mockImplementation((_name, callback) => {
      listener = callback;
      return new Promise<{ remove: () => Promise<void> }>((resolve) => {
        registered = resolve;
      });
    });
  const adapter: AndroidBackAdapter & { exitApp: () => Promise<void> } = {
    addListener,
    exitApp: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  const historyBack = vi.fn();
  vi.stubGlobal("window", { history: { back: historyBack } });
  return {
    adapter,
    addListener,
    remove,
    historyBack,
    press: (canGoBack: boolean) => listener({ canGoBack }),
    ready: () => registered({ remove }),
  };
}
function mountEffects() {
  for (const effect of mounted.effects) {
    const cleanup = effect();
    if (cleanup) mounted.cleanups.push(cleanup);
  }
}

const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  memberships: [
    {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-one",
      issuerName: "Invented issuer",
      listingId: "listing-one",
      securityId: "security-one",
      securityName: "Common stock",
      shareClassId: "class-one",
      shareClassName: "Class A",
      symbol: "DEMO",
      note: "Private research note",
    },
  ],
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  catalogId: "synthetic-catalog",
  catalogVersion: "synthetic-version",
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
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture(initial = payload) {
  const api: ManagedApi = {
    eodHistory: vi.fn(),
    annualReport: vi.fn(),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload: initial }),
    save: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn(),
    resolve: vi.fn(),
  };
  const workspace = new ManagedWorkspace(api, {
    userId: "synthetic-user",
    sessionId: "synthetic-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  });
  workspace.setView("discover");
  return {
    workspace,
    api,
    html: (androidBack?: AndroidBackAdapter) =>
      renderToStaticMarkup(
        <ManagedWorkspaceScreen
          workspace={workspace}
          {...(androidBack ? { androidBack } : {})}
        />,
      ),
  };
}
function elements(
  node: React.ReactNode,
): React.ReactElement<{ children?: React.ReactNode }>[] {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
describe("managed workspace screen", () => {
  it("shares the company note with the watchlist row and reviews all changes without saving", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    mounted.direct = true;
    const company = () => {
      mounted.refIndex = 0;
      return elements(ManagedWorkspaceScreen({ workspace })).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const note = () =>
      elements(ManagedCompanyResearch(company().props)).find(
        (node) => node.type === ManagedResearchNote,
      ) as React.ReactElement<React.ComponentProps<typeof ManagedResearchNote>>;
    const input = () =>
      elements(ManagedResearchNote(note().props)).find(
        (node) => node.type === "textarea",
      ) as React.ReactElement<React.ComponentProps<"textarea">>;
    expect(input().props.value).toBe("Private research note");
    expect(input().props.id).toBe("managed-research-note");
    expect(input().props.disabled).toBe(false);
    input().props.onChange!({
      target: { value: "  Shared research draft  " },
    } as React.ChangeEvent<HTMLTextAreaElement>);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("  Shared research draft  ");
    company().props.onSection("annual");
    expect(input().props.value).toBe("  Shared research draft  ");
    workspace.note("listing-one", "Edited from the watchlist row");
    expect(input().props.value).toBe("Edited from the watchlist row");
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    const review = elements(ManagedResearchNote(note().props)).find(
      (node) =>
        node.type === "button" &&
        node.props.children === "Review in My Watchlist",
    ) as React.ReactElement<React.ComponentProps<"button">>;
    review.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    expect(focus).toHaveBeenCalledOnce();
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    mounted.direct = false;
    expect(html()).toContain("Edited from the watchlist row");
  });

  it("adds from a captured discovery visit and fences old note and review controls", async () => {
    const { workspace, api, html } = fixture({ ...payload, memberships: [] });
    const listing = {
      ...payload.memberships[0]!,
      cik: "0000000001",
      matchKind: "current_symbol_exact" as const,
      matchedValue: "DEMO",
    };
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [listing],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.coordinator.load();
    await workspace.search();
    workspace.openDiscoveryAnnual(listing);
    mounted.direct = true;
    const company = () => {
      mounted.refIndex = 0;
      return elements(ManagedWorkspaceScreen({ workspace })).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const first = company();
    expect(first.props.watchlist.canAdd).toBe(true);
    expect(first.props.watchlist.member).toBeNull();
    workspace.setQuery("Search changed after opening the visit");
    first.props.onAdd();
    expect(company().props.watchlist.member?.note).toBe("");
    company().props.onNote("Draft before reviewing");
    mounted.direct = false;
    const output = html();
    expect(output).toContain('for="managed-research-note"');
    expect(output).toContain("In watchlist draft");
    expect(output).toContain(
      "Review and save all watchlist changes in My Watchlist.",
    );
    expect(output).toContain("Draft before reviewing");
    const before = workspace.coordinator.getSnapshot().draft;
    workspace.openWatchlistAnnual(before!.memberships[0]!);
    const replacement = workspace.getSnapshot().research;
    first.props.onNote("Stale control must not write");
    first.props.onAdd();
    first.props.onReview();
    expect(workspace.getSnapshot().research).toBe(replacement);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("shows a read-only research note and recovery guidance during an uncertain save", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    workspace.note("listing-one", "Keep the uncertain draft");
    vi.mocked(api.save).mockRejectedValue(new TrialApiError("commit_unknown"));
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().uncertain).toBe(true);
    const output = html();
    expect(output).toMatch(
      /<textarea\b[^>]*id="managed-research-note"[^>]*disabled=""/u,
    );
    expect(output).toContain("Keep the uncertain draft");
    expect(output).toContain("Review in My Watchlist");
    expect(output).not.toContain("Save research note");
  });
  it("moves focus to persistent watchlist navigation when leaving the board action", () => {
    const { workspace } = fixture();
    workspace.setView("markets");
    mounted.direct = true;
    const node = ManagedWorkspaceScreen({ workspace });
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    const board = elements(node).find(
      (element) => element.type === ManagedMarkets,
    )!;
    (board.props as React.ComponentProps<typeof ManagedMarkets>).onWatchlist();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    expect(focus).toHaveBeenCalledOnce();
    expect(workspace.markets.getSnapshot().active).toBe(false);
  });
  it.each([
    ["annual", "screen"],
    ["eod", "screen"],
    ["annual", "native"],
    ["eod", "native"],
  ] as const)(
    "switches from %s without a request and restores the original opener with %s Back",
    async (start, back) => {
      const native = back === "native" ? nativeBackFixture() : null;
      const { workspace, api } = fixture({
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
          },
        ],
      });
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setQuery("DEMO");
      workspace.note("listing-one", "Keep the navigation draft");
      workspace.move("listing-two", -1);
      const draft = workspace.coordinator.getSnapshot().draft;
      mounted.direct = true;
      const render = () => {
        mounted.refIndex = 0;
        return ManagedWorkspaceScreen({
          workspace,
          ...(native ? { androidBack: native.adapter } : {}),
        });
      };
      const first = render();
      if (native) {
        mountEffects();
        native.ready();
      }
      const label = `${start === "annual" ? "Annual report" : "EOD close history"} for saved DEMO`;
      const opener = elements(first).find(
        (node) =>
          node.type === "button" &&
          (node.props as { "aria-label"?: string })["aria-label"] === label,
      ) as React.ReactElement<{
        onClick: (event: { currentTarget: unknown }) => void;
      }>;
      expect(opener).toBeDefined();
      const origin = { isConnected: true, focus: vi.fn() };
      opener.props.onClick({ currentTarget: origin });
      const company = () =>
        elements(render()).find(
          (node) => node.type === ManagedCompanyResearch,
        ) as React.ReactElement<
          React.ComponentProps<typeof ManagedCompanyResearch>
        >;
      const selection = company().props.research.selection;
      const opposite = start === "annual" ? "eod" : "annual";
      company().props.onSection(opposite);
      expect(company().props.research.section).toBe(opposite);
      expect(company().props.research.selection).toBe(selection);
      expect(workspace.annual.getSnapshot().selection?.listing.listingId).toBe(
        "listing-one",
      );
      expect(workspace.eod.getSnapshot().selection?.listing.listingId).toBe(
        "listing-one",
      );
      expect(mounted.refs[0]!.current).toBe(origin);
      company().props.onSection(start);
      expect(company().props.research.section).toBe(start);
      expect(company().props.research.selection).toBe(selection);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(workspace.getSnapshot().query).toBe("DEMO");
      expect(
        elements(render())
          .filter((node) => node.type === "textarea")
          .map((node) => (node.props as { value: string }).value),
      ).toEqual(["Private research note", "Keep the navigation draft"]);
      expect(origin.focus).not.toHaveBeenCalled();
      const current = company();
      if (native) native.press(false);
      else current.props.onBack();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.eod.getSnapshot().selection).toBeNull();
      expect(origin.focus).toHaveBeenCalledOnce();
      expect(mounted.refs[0]!.current).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
      if (native) {
        native.press(false);
        expect(native.historyBack).not.toHaveBeenCalled();
        expect(native.adapter.exitApp).not.toHaveBeenCalled();
        expect(origin.focus).toHaveBeenCalledOnce();
      }
    },
  );
  it("renders one company section and reuses both loaded packets through repeated button returns", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Keep this company note" },
      ],
    });
    const prices = eodResponse();
    const report = await annualResponse();
    vi.mocked(api.eodHistory).mockResolvedValue(prices);
    vi.mocked(api.annualReport).mockResolvedValue(report);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    mounted.direct = true;
    const render = () => {
      mounted.refIndex = 0;
      return ManagedWorkspaceScreen({ workspace });
    };
    const origin = { isConnected: true, focus: vi.fn() };
    const opener = elements(render()).find(
      (node) =>
        node.type === "button" &&
        (node.props as { "aria-label"?: string })["aria-label"] ===
          "EOD close history for saved ZERO",
    ) as React.ReactElement<{
      onClick: (event: { currentTarget: unknown }) => void;
    }>;
    opener.props.onClick({ currentTarget: origin });
    const company = () =>
      elements(render()).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    const section = (name: "Price" | "Annual") => {
      const control = elements(ManagedCompanyResearch(company().props)).find(
        (node) =>
          node.type === "button" &&
          (node.props as { "aria-label"?: string })["aria-label"] ===
            `${name} section for ZERO`,
      ) as React.ReactElement<{ onClick: () => void; "aria-pressed": boolean }>;
      return control.props;
    };
    const html = () => {
      const node = company();
      mounted.direct = false;
      try {
        return renderToStaticMarkup(node);
      } finally {
        mounted.direct = true;
      }
    };
    const identity = company().props.research.selection;
    expect(html()).toContain("Company research · ZERO");
    for (const label of ["Zero Company", "Zero Class A", "Class A", "XNAS"])
      expect(html()).toContain(label);
    expect(section("Price")["aria-pressed"]).toBe(true);
    expect(section("Annual")["aria-pressed"]).toBe(false);
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    await workspace.eod.load();
    const priceState = workspace.eod.getSnapshot();
    const priceHtml = html();
    expect(priceHtml).toContain(prices.completedAt);
    expect(priceHtml).toContain(prices.window.startDate);
    expect(priceHtml).not.toContain('class="managed-annual-report"');
    section("Price").onClick();
    expect(workspace.eod.getSnapshot()).toBe(priceState);
    section("Annual").onClick();
    expect(section("Annual")["aria-pressed"]).toBe(true);
    expect(section("Price")["aria-pressed"]).toBe(false);
    expect(html()).not.toContain('class="managed-eod-history"');
    expect(api.annualReport).not.toHaveBeenCalled();
    await workspace.annual.load();
    const annualState = workspace.annual.getSnapshot();
    const annualHtml = html();
    expect(annualHtml).toContain(report.evidence.generation.completedAt);
    expect(annualHtml.match(/Back to workspace/gu)).toHaveLength(1);
    expect(annualHtml.match(/id="managed-company-heading"/gu)).toHaveLength(1);
    section("Annual").onClick();
    expect(workspace.annual.getSnapshot()).toBe(annualState);
    for (let visit = 0; visit < 2; visit++) {
      section("Price").onClick();
      expect(html()).toBe(priceHtml);
      expect(workspace.eod.getSnapshot()).toBe(priceState);
      section("Annual").onClick();
      expect(html()).toBe(annualHtml);
      expect(workspace.annual.getSnapshot()).toBe(annualState);
      expect(company().props.research.selection).toBe(identity);
    }
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(mounted.refs[0]!.current).toBe(origin);
    company().props.onBack();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(origin.focus).toHaveBeenCalledOnce();
  });
  it("opens EOD explicitly beside the unchanged draft and gates stale catalog entries", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Draft survives close history");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistEod(member);
    const output = html();
    expect(output).toContain("Company research · DEMO");
    expect(output).toContain("Load one-month close history");
    expect(output).toContain("Draft survives close history");
    expect(output).toContain("My Watchlist");
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    workspace.openWatchlistAnnual(member);
    expect(html()).not.toContain("Load one-month close history");
    expect(html()).toContain("Load annual report");
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    await workspace.refreshCatalog();
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="EOD close history for saved DEMO"/u,
    );
  });
  it.each([false, true])(
    "native Back consumes a pending EOD panel, restores focus and keeps the draft (history %s)",
    async (canGoBack) => {
      const native = nativeBackFixture();
      const { workspace, api, html } = fixture();
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Keep my EOD draft");
      html(native.adapter);
      mountEffects();
      native.ready();
      const focus = vi.fn();
      mounted.refs[0]!.current = { isConnected: true, focus };
      workspace.openWatchlistEod(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValue(held.promise);
      const pending = workspace.eod.load();
      const before = workspace.coordinator.getSnapshot().draft;
      native.press(canGoBack);
      expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(true);
      expect(workspace.eod.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
      });
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(focus).toHaveBeenCalledOnce();
      expect(native.historyBack).not.toHaveBeenCalled();
      held.resolve(eodResponse());
      await pending;
      expect(workspace.eod.getSnapshot().response).toBeNull();
      native.press(false);
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      native.press(true);
      expect(native.historyBack).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );
  it("keeps the shared Search pending label and editable query by default", () => {
    const output = renderToStaticMarkup(
      <WorkspaceSearch
        query="DEMO"
        busy
        disabled={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );
    expect(output).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    const input = output.match(/<input\b[^>]*>/u)?.[0];
    expect(input).toBeDefined();
    expect(input).toContain('value="DEMO"');
    expect(input).not.toContain('disabled=""');
  });
  it.each([false, true])(
    "labels a pending catalog status read without calling it Search (existing receipt: %s)",
    async (hasSnapshot) => {
      const { workspace, api, html } = fixture();
      await workspace.coordinator.load();
      if (hasSnapshot) await workspace.refreshCatalog();
      workspace.setQuery("DEMO");
      workspace.note("listing-one", "Draft during catalog read");
      const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
      vi.mocked(api.status).mockReturnValueOnce(status.promise);
      const pending = workspace.refreshCatalog();
      const output = html();
      const label = hasSnapshot ? "Refreshing catalog…" : "Loading catalog…";
      expect(output).toContain(`disabled="">${label}</button>`);
      expect(output).toContain(
        '<button type="submit" disabled="">Search</button>',
      );
      expect(output).not.toContain("Searching…");
      const input = output.match(
        /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
      )?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('value="DEMO"');
      expect(input).not.toContain('disabled=""');
      expect(output).toContain("Draft during catalog read");
      expect(output).toContain("Unsaved changes");
      if (hasSnapshot) expect(output).toContain(snapshot.asOf);
      else expect(output).not.toContain("Catalog as of");
      status.resolve({ snapshot });
      await pending;
      expect(html()).toContain('<button type="submit">Search</button>');
      expect(html()).not.toContain(label);
    },
  );
  it("shows explicit startup catalog recovery with the same visible query and draft", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.status).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.refreshCatalog();
    const failure =
      "The catalog could not be loaded. Select Refresh catalog to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).toContain("Private research note");
    expect(failed).not.toContain("Catalog as of");
    expect(failed).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Refresh catalog<\/button>/u,
    );
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives catalog recovery");
    const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
    vi.mocked(api.status).mockReturnValueOnce(status.promise);
    const pending = workspace.refreshCatalog();
    const recovering = html();
    expect(recovering).toContain("Loading catalog…");
    expect(recovering).toContain('value="DEMO"');
    expect(recovering).toContain("Draft survives catalog recovery");
    expect(recovering).toContain("Unsaved changes");
    expect(recovering).not.toContain("Catalog as of");
    status.resolve({ snapshot });
    await pending;
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain("Draft survives catalog recovery");
    expect(recovered).toContain("Unsaved changes");
    expect(recovered).toContain(
      `2 available listings · Catalog as of ${snapshot.asOf}`,
    );
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.status).toHaveBeenCalledTimes(2);
    expect(api.search).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("keeps Search pending and recovery feedback distinct from the dated catalog", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives search failure");
    const search = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
    vi.mocked(api.search).mockReturnValueOnce(search.promise);
    const pending = workspace.search();
    const searching = html();
    expect(searching).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    expect(searching).toContain('disabled="">Refresh catalog</button>');
    expect(searching).not.toContain("Refreshing catalog…");
    const input = searching.match(
      /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
    )?.[0];
    expect(input).toBeDefined();
    expect(input).not.toContain('disabled=""');
    search.reject(new TrialApiError("unavailable"));
    await pending;
    const failure =
      "The search could not be completed. Select Search to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).not.toContain("The catalog could not be loaded.");
    expect(failed).toContain('<button type="submit">Search</button>');
    expect(failed).toContain('value="DEMO"');
    expect(failed).toContain("Draft survives search failure");
    expect(failed).toContain(snapshot.asOf);
    vi.mocked(api.search).mockResolvedValueOnce({
      snapshot,
      results: [],
      totalMatches: 0,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.search();
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain("No matching listings in this catalog.");
    expect(recovered).toContain("Draft survives search failure");
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain(snapshot.asOf);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("directs a failed catalog review to its own existing action", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.reviewCatalog();
    const output = html();
    expect(output).toContain(
      "The catalog review could not be completed. Select Review catalog changes to try again.",
    );
    expect(output).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Review catalog changes<\/button>/u,
    );
    expect(output).toContain(snapshot.asOf);
    expect(output).toContain("Private research note");
    expect(api.save).not.toHaveBeenCalled();
  });
  it("does not install native navigation for the browser screen", () => {
    const native = nativeBackFixture();
    fixture().html();
    mountEffects();
    expect(native.addListener).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "consumes Annual Back before native history (%s), restores focus and preserves the draft",
    async (canGoBack) => {
      const native = nativeBackFixture();
      const initial = {
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
          },
        ],
      };
      const { workspace, html } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Unsaved native note");
      workspace.move("listing-two", -1);
      html(native.adapter);
      mountEffects();
      native.ready();
      const focus = vi.fn();
      mounted.refs[0]!.current = { isConnected: true, focus };
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!,
      );
      const before = structuredClone(workspace.coordinator.getSnapshot().draft);
      native.press(canGoBack);
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(focus).toHaveBeenCalledOnce();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      native.press(false);
      expect(native.historyBack).not.toHaveBeenCalled();
      native.press(true);
      expect(native.historyBack).toHaveBeenCalledOnce();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
    },
  );
  it("native Back aborts a pending read and fences its late result while restoring fallback focus", async () => {
    const native = nativeBackFixture();
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    html(native.adapter);
    mountEffects();
    native.ready();
    const focus = vi.fn();
    mounted.refs[0]!.current = { isConnected: false, focus: vi.fn() };
    mounted.refs[1]!.current = { focus };
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    let complete!: (
      value: Awaited<ReturnType<ManagedApi["annualReport"]>>,
    ) => void;
    vi.mocked(api.annualReport).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const pending = workspace.annual.load();
    const signal = vi.mocked(api.annualReport).mock.calls[0]![1];
    native.press(false);
    expect(signal.aborted).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    complete(await annualResponse());
    await pending;
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(native.historyBack).not.toHaveBeenCalled();
  });
  it.each(["retire", "unmount"] as const)(
    "fences %s immediately and removes late registration once",
    async (reason) => {
      const native = nativeBackFixture();
      const { workspace, html } = fixture();
      await workspace.coordinator.load();
      html(native.adapter);
      mountEffects();
      if (reason === "retire") workspace.coordinator.retire();
      else mounted.cleanups[0]!();
      native.press(true);
      native.press(false);
      native.ready();
      await Promise.resolve();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      expect(native.remove).toHaveBeenCalledOnce();
      mounted.cleanups[0]!();
      expect(native.remove).toHaveBeenCalledOnce();
    },
  );
  it("keeps the watchlist mounted beside an explicit annual panel and gates old catalog entries", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Draft survives Back");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    const output = html();
    expect(output).toContain("Company research · DEMO");
    expect(output).toContain("Load annual report");
    expect(output).toContain("Back to workspace");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Draft survives Back");
    expect(output).toContain("Unsaved changes");
    expect(api.annualReport).not.toHaveBeenCalled();
    workspace.closeResearch();
    expect(html()).not.toContain("Load annual report");
    expect(html()).toContain("Draft survives Back");
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    await workspace.refreshCatalog();
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Annual report for saved DEMO"/u,
    );
    expect(html()).toContain(
      "before adding, saving or opening an annual report",
    );
  });
  it("renders the reused accessible search and full exact-listing editing controls", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain('aria-label="Find a company"');
    expect(output).toContain('maxLength="128"');
    expect(output).toContain("Discover");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Invented issuer");
    expect(output).toContain("Class A");
    expect(output).toContain("XNAS");
    expect(output).toContain("Listing ID: listing-one");
    expect(output).toContain('for="managed-note-0"');
    expect(output).toContain("Private research note");
    expect(output).toContain('aria-label="Move DEMO up"');
    expect(output).toContain('aria-label="Remove DEMO"');
    expect(output).toContain("Save watchlist");
    expect(output).toContain("Review catalog changes");
    expect(output).toContain("Sign out this session");
    expect(output).toContain('aria-live="polite"');
  });

  it("clears private notes, query and controls immediately on retirement", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.setQuery("Private search");
    workspace.coordinator.retire();
    const output = html();
    expect(output).not.toContain("Private research note");
    expect(output).not.toContain("Private search");
    expect(output).not.toContain("textarea");
    expect(output).not.toContain("Find a company");
    expect(output).not.toContain("Save watchlist");
    expect(output).toContain("local watchlist data has been cleared");
  });

  it("presents the latest saved notes before the explicit conflict choices", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.note("listing-one", "My changed draft");
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain("My changed draft");
    expect(output).toContain("Private research note");
    expect(output).toContain("Saved version 1");
    expect(output).toContain("Use saved version");
    expect(output).toContain("Keep my draft");
    expect(output).toContain("the next save replaces this saved version");
  });

  it("uses product copy for managed mode while preserving the default DEMO frame", () => {
    const managed = renderToStaticMarkup(
      <TrialFrame managed>
        <p>Managed workspace</p>
      </TrialFrame>,
    );
    const demo = renderToStaticMarkup(
      <TrialFrame>
        <p>Demo workspace</p>
      </TrialFrame>,
    );
    expect(managed).toContain("Discover companies");
    expect(managed).not.toContain("Synthetic data only");
    expect(managed).toContain("Software licenses");
    expect(demo).toContain("Synthetic data only");
    expect(demo).toContain("isolated trial");
  });

  it("shows finite access failure without rendering saved data", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.load).mockRejectedValueOnce(
      new TrialApiError("access_denied"),
    );
    await workspace.coordinator.load();
    expect(html()).toContain("cannot access the shared watchlist");
    expect(html()).not.toContain("Private research note");
  });

  it("labels catalog identity changes for people and keeps confirmation accurate after saving", async () => {
    const { workspace, api, html } = fixture();
    const updatedSnapshot: ManagedCatalogSnapshotDto = {
      ...snapshot,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    vi.mocked(api.status).mockResolvedValue({ snapshot: updatedSnapshot });
    vi.mocked(api.resolve).mockResolvedValue({
      snapshotSha256: updatedSnapshot.snapshotSha256,
      results: [
        {
          listingId: "listing-one",
          listing: {
            country: "US",
            exchangeMic: "XNYS",
            instrumentType: "adr",
            issuerId: "issuer-updated",
            issuerName: "Updated invented issuer",
            listingId: "listing-one",
            securityId: "security-updated",
            securityName: "Updated security",
            shareClassId: "class-updated",
            shareClassName: "Updated share class",
            symbol: "NEXT",
          },
        },
      ],
    });
    vi.mocked(api.save).mockImplementation((command) =>
      Promise.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    await workspace.reviewCatalog();
    const review = html();
    for (const [key, label] of [
      ["exchangeMic", "Exchange MIC"],
      ["instrumentType", "Instrument type"],
      ["issuerId", "Issuer ID"],
      ["issuerName", "Company name"],
      ["securityId", "Security ID"],
      ["securityName", "Security name"],
      ["shareClassId", "Share class ID"],
      ["shareClassName", "Share class name"],
      ["symbol", "Ticker"],
    ]) {
      expect(review).toContain(`<dt>${label}</dt>`);
      expect(review).not.toContain(`<dt>${key}</dt>`);
    }
    workspace.applyReview();
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).toContain("Unsaved changes");
    await workspace.coordinator.save();
    expect(html()).toContain("Version 2 · Saved");
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).not.toContain("Save the watchlist to share them");
    expect(html()).toContain("Private research note");
  });

  it("disables Save with an explanation for invalid notes, then enables it after correction", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "x".repeat(2001));
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "Use at most 2,000 characters per note, without control characters.",
    );
    workspace.note("listing-one", "Corrected note");
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    expect(html()).not.toContain('id="managed-save-issue"');
  });

  it("enables Save at the exact canonical byte limit and explains one extra byte before dispatch", async () => {
    const memberships = Array.from({ length: 32 }, (_, index) => ({
      ...payload.memberships[0]!,
      listingId: `listing-${index}`,
      issuerName: "😀".repeat(128),
      securityName: "😀".repeat(128),
      shareClassName: "😀".repeat(128),
      note: "",
    }));
    const maximum = { ...payload, memberships };
    const bytes = () =>
      new TextEncoder().encode(encodeMainWatchlistPayload(maximum)).byteLength;
    let remaining = 262144 - bytes();
    for (const member of memberships) {
      const astral = Math.min(2000, Math.floor(remaining / 4));
      const ascii = Math.min(2000 - astral, remaining - astral * 4);
      member.note = "😀".repeat(astral) + "x".repeat(ascii);
      remaining -= astral * 4 + ascii;
    }
    expect(remaining).toBe(0);
    expect(bytes()).toBe(262144);
    const { workspace, api, html } = fixture(maximum);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const last = memberships.at(-1)!;
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    workspace.note(last.listingId, `${last.note}x`);
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "This watchlist is too large to save. Shorten notes or remove entries.",
    );
    await workspace.coordinator.save();
    expect(api.save).not.toHaveBeenCalled();
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
  });
});
