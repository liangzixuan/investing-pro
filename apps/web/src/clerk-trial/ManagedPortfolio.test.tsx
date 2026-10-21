import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type {
  ManagedCatalogSnapshotDto,
  ManagedPortfolioDto,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { ManagedPortfolio } from "./ManagedPortfolio";
import { ManagedPortfolioDraftFiles } from "./ManagedPortfolioDraftFiles";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { bindManagedBrowserUnload } from "./managed-browser-unload";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import {
  PersonalPortfolioLedgerEditor,
  type PersonalPortfolioLedgerEditorProps,
} from "../features/research/PersonalPortfolioLedgerEditor";

// Controlled event callbacks exercise real models; mounted geometry remains browser QA.
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  layouts: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: <T,>(initial: T) => {
      if (!hooks.direct) return actual.useRef(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
    useLayoutEffect: (effect: () => void, deps: React.DependencyList) => {
      if (!hooks.direct) return actual.useLayoutEffect(effect, deps);
      const index = hooks.index++;
      const previous = hooks.slots[index] as React.DependencyList | undefined;
      if (
        !previous ||
        deps.some((value, at) => !Object.is(value, previous[at]))
      )
        hooks.layouts.push(effect);
      hooks.slots[index] = deps;
    },
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
      snapshot(),
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [
        hooks.slots[index],
        (value: unknown) => {
          hooks.slots[index] = value;
        },
      ];
    },
  };
});
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.layouts = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const digest = eodSelection.catalogSnapshotSha256;
const identity = eodSelection.listing;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  catalogId: "invented",
  catalogVersion: "one",
  snapshotSha256: digest,
  asOf: "2026-10-01T00:00:00Z",
  acquiredAt: "2026-10-01T00:00:00Z",
  generatedAt: "2026-10-01T00:00:00Z",
  attribution: "Invented engineering catalog",
  contentKind: "synthetic_engineering",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 4,
    activeListings: 4,
    admittedSourceRecords: 4,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 4,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 4,
    staleSourceRecords: 0,
    shareClasses: 4,
    totalSecurities: 4,
    unsupportedSourceRecords: 0,
  },
};
const ledger = (): ManagedPortfolioPayload => ({
  schemaVersion: 3,
  name: "My Portfolio",
  currency: "USD",
  snapshotSha256: digest,
  basisMethod: "fifo_with_opening_pool",
  identities: [identity],
  opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
  transactions: [],
});
function fixture(initial: ManagedPortfolioPayload | null = null) {
  let stored: ManagedPortfolioDto = initial
    ? { version: 1, payload: initial }
    : { version: 0, payload: null };
  const api: ManagedApi = {
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: vi.fn<ManagedApi["loadPortfolio"]>(() =>
      Promise.resolve(stored),
    ),
    savePortfolio: vi.fn<ManagedApi["savePortfolio"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: command.payload,
      };
      return Promise.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      });
    }),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue({
      version: 1,
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: digest,
        memberships: [{ ...identity, note: "Original note" }],
      },
    }),
    save: vi.fn(),
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>().mockResolvedValue({
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    }),
    saveFollowups: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn<ManagedApi["search"]>().mockResolvedValue({
      snapshot,
      results: [
        {
          ...identity,
          cik: "0000000001",
          matchKind: "current_symbol_exact",
          matchedValue: identity.symbol,
        },
      ],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    }),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: identity,
        })),
      }),
    ),
    eodHistory: vi.fn(),
    annualReport: vi.fn(),
    recentFilings: vi.fn(),
    monetaryAnnouncements: vi.fn(),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn(),
  };
  const session = {
    userId: "invented-portfolio-user",
    sessionId: "invented-portfolio-session",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const workspace = new ManagedWorkspace(
    api,
    session,
    () => "invented-portfolio-command",
    { researchCoverage: inventedManagedResearchCoverage },
  );
  workspace.setView("portfolio");
  const research = vi.fn<
    React.ComponentProps<typeof ManagedPortfolio>["onResearch"]
  >((draft, listing) => workspace.openPortfolioResearch(draft, listing));
  const render = (
    navigationPending = false,
    draftFiles?: {
      draftFileScope: Promise<string>;
      draftFileRouteActive: () => boolean;
    },
  ) => {
    hooks.index = 0;
    hooks.direct = true;
    const tree = ManagedPortfolio({
      workspace,
      navigationPending,
      onResearch: research,
      ...draftFiles,
    });
    hooks.direct = false;
    return {
      tree,
      html: renderToStaticMarkup(tree),
      button: (id: string) =>
        nodes(tree).find((node) => node.props.id === id)!
          .props as React.ComponentProps<"button">,
      editor: () =>
        nodes(tree).find((node) => node.type === PersonalPortfolioLedgerEditor)!
          .props as unknown as PersonalPortfolioLedgerEditorProps,
    };
  };
  return {
    workspace,
    api,
    session,
    render,
    setStored: (value: ManagedPortfolioDto) => {
      stored = value;
    },
  };
}
function nodes(
  tree: React.ReactNode,
): React.ReactElement<{ id?: string; children?: React.ReactNode }>[] {
  return React.Children.toArray(tree).flatMap((child) =>
    React.isValidElement<{ id?: string; children?: React.ReactNode }>(child)
      ? [child, ...nodes(child.props.children)]
      : [],
  );
}
function click(button: React.ComponentProps<"button">) {
  button.onClick!({ currentTarget: {} } as React.MouseEvent<HTMLButtonElement>);
}
async function settle() {
  for (let count = 0; count < 8; count++) await Promise.resolve();
}
async function loaded(f: ReturnType<typeof fixture>) {
  await f.workspace.refreshCatalog();
  await f.workspace.portfolio.coordinator.load();
}
async function approved(f: ReturnType<typeof fixture>) {
  await loaded(f);
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
}

function entryHeading(tree: React.ReactNode) {
  const node = nodes(tree).find(
    (entry) => entry.props.id === "managed-portfolio-heading",
  ) as React.ReactElement<
    React.ComponentProps<"h2"> & {
      ref: React.RefObject<HTMLHeadingElement | null>;
    }
  >;
  const document = { activeElement: {} };
  const panel = { contains: vi.fn(() => false) };
  const target = {
    isConnected: true,
    ownerDocument: document,
    closest: vi.fn((selector: string) =>
      selector === ".managed-portfolio" ? panel : null,
    ),
    getClientRects: () => [{ width: 300, height: 44 }],
    focus: vi.fn(() => {
      document.activeElement = target;
    }),
  };
  node.props.ref.current = target as unknown as HTMLHeadingElement;
  return { target, document, panel };
}
function commitLayouts() {
  for (const effect of hooks.layouts.splice(0)) effect();
}

it("focuses the Portfolio heading once when entry commits and leaves later review and research-return focus alone", async () => {
  const f = fixture(ledger());
  await approved(f);
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  const h = entryHeading(f.render(true).tree);
  commitLayouts();
  expect(h.target.focus).not.toHaveBeenCalled();
  f.render(false);
  commitLayouts();
  expect(h.target.focus).toHaveBeenCalledOnce();
  expect(h.document.activeElement).toBe(h.target);
  const reviewTarget = { focus: vi.fn() };
  h.document.activeElement = reviewTarget;
  click(f.render().button("managed-portfolio-review"));
  f.render();
  commitLayouts();
  expect(h.document.activeElement).toBe(reviewTarget);
  f.workspace.openPortfolioResearch(draft, draft.ledger!.identities[0]!);
  f.render(true);
  commitLayouts();
  f.workspace.closeResearch();
  const opener = { focus: vi.fn() };
  h.document.activeElement = opener;
  f.render(false);
  commitLayouts();
  expect(h.document.activeElement).toBe(opener);
  expect(h.target.focus).toHaveBeenCalledOnce();
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
});

it.each(["pending form", "review focus", "hidden", "retired"])(
  "does not take initial heading focus from %s or queue it for later",
  async (state) => {
    const f = fixture(ledger());
    await approved(f);
    const h = entryHeading(f.render().tree);
    const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
    if (state === "pending form")
      f.workspace.portfolio.setPendingEditor(draft, true);
    if (state === "review focus") h.panel.contains.mockReturnValue(true);
    if (state === "hidden") h.target.closest.mockReturnValue(h.panel);
    if (state === "retired")
      f.workspace.sessionOwner.retire("Invented entry-focus retirement");
    commitLayouts();
    expect(h.target.focus).not.toHaveBeenCalled();
    f.workspace.portfolio.setPendingEditor(draft, false);
    h.panel.contains.mockReturnValue(false);
    h.target.closest.mockImplementation((selector: string) =>
      selector === ".managed-portfolio" ? h.panel : null,
    );
    f.render(true);
    commitLayouts();
    f.render(false);
    commitLayouts();
    expect(h.target.focus).not.toHaveBeenCalled();
  },
);

it("loads an uninitialized portfolio only on explicit action and preserves unknown opening cash", async () => {
  const f = fixture();
  expect(f.render().html).toContain("Portfolio has not been loaded");
  expect(f.api.loadPortfolio).not.toHaveBeenCalled();
  await f.workspace.refreshCatalog();
  click(f.render().button("managed-portfolio-load"));
  await settle();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toEqual({
    ledger: null,
  });
  expect(f.render().html).toContain("No portfolio has been saved");
  f.workspace.portfolio.start("2026-10-01", null);
  expect(f.render().html).toContain("Opening cash is unknown");
  click(f.render().button("managed-portfolio-review"));
  click(f.render().button("managed-portfolio-save"));
  await settle();
  expect(f.api.savePortfolio).toHaveBeenCalledOnce();
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().saved?.payload.ledger
      ?.opening,
  ).toEqual({ asOfDate: "2026-10-01", cashUsd: null, holdings: [] });
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("guards stale Load, Review and Save before a pending raw editor can change coordinator phase", async () => {
  const f = fixture(ledger());
  await approved(f);
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  f.workspace.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "1234.56" },
  });
  click(f.render().button("managed-portfolio-review"));
  const old = f.render();
  const editor = old.editor();
  const captured = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  editor.onPendingEditsChange!(true);
  const state = f.workspace.portfolio.coordinator.getSnapshot();
  click(old.button("managed-portfolio-load"));
  click(old.button("managed-portfolio-review"));
  click(old.button("managed-portfolio-save"));
  f.workspace.setView("markets");
  f.workspace.setQuery("OTHER");
  await f.workspace.search();
  await f.workspace.refreshCatalog();
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(state);
  expect(f.api.loadPortfolio).toHaveBeenCalledOnce();
  expect(f.api.status).toHaveBeenCalledOnce();
  expect(f.api.search).not.toHaveBeenCalled();
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  expect(f.render().html).toContain("Apply or reset the portfolio form");
  expect(f.render().editor().disabled).toBe(false);
  editor.onChange({
    ...captured.ledger!,
    opening: { ...captured.ledger!.opening, cashUsd: "1200.00" },
  });
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
  const replacement = f.workspace.portfolio.coordinator.getSnapshot().draft;
  editor.onPendingEditsChange!(true);
  editor.onChange(captured.ledger!);
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(
    replacement,
  );
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
});

it("uses the shared exact ledger editor and exposes unknown basis without substituting zero", async () => {
  const value = ledger();
  const f = fixture({
    ...value,
    opening: {
      ...value.opening,
      cashUsd: null,
      holdings: [
        {
          listingId: identity.listingId,
          shares: "2",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [
      {
        id: "sell-one",
        date: "2026-10-02",
        type: "sell",
        listingId: identity.listingId,
        shares: "1",
        grossUsd: "150.00",
        feeUsd: "1.00",
      },
    ],
  });
  await approved(f);
  const view = f.render();
  expect(view.html).toContain("Total realized gain");
  expect(view.html).toContain("Unknown");
  expect(view.html).toContain("USD 0.00");
  expect(view.html).toContain("1 of 1");
  expect(view.editor().profile).toBe("managed");
  expect(view.editor().saveHelp).not.toContain("encrypt");
  expect(view.html).not.toContain("Register selected listing");
  expect(f.workspace.portfolio.getProjection()).toMatchObject({
    status: "valid",
    cashCheck: "unknown_opening_cash",
    realized: {
      unknownSales: 1,
      totalGainUsd: null,
      knownGainSubtotalUsd: "0.00",
    },
  });
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
});

it("keeps all three drafts through research return and retires them together before a late save", async () => {
  const f = fixture(ledger());
  await approved(f);
  await f.workspace.coordinator.load();
  await f.workspace.followups.coordinator.load();
  f.workspace.note(identity.listingId, "  Watchlist raw note 财报  ");
  f.workspace.followups.add({ ...identity, note: "" }, "2026-10-30");
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  f.workspace.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "900.00" },
  });
  const before = [
    f.workspace.coordinator.getSnapshot().draft,
    f.workspace.followups.coordinator.getSnapshot().draft,
    f.workspace.portfolio.coordinator.getSnapshot().draft,
  ];
  f.workspace.openPortfolioResearch(
    before[2] as typeof draft,
    (before[2] as typeof draft).ledger!.identities[0]!,
  );
  expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
    "portfolio",
  );
  f.workspace.closeResearch();
  expect([
    f.workspace.coordinator.getSnapshot().draft,
    f.workspace.followups.coordinator.getSnapshot().draft,
    f.workspace.portfolio.coordinator.getSnapshot().draft,
  ]).toEqual(before);
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  let finish!: (
    value: Awaited<ReturnType<ManagedApi["savePortfolio"]>>,
  ) => void;
  vi.mocked(f.api.savePortfolio).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  click(f.render().button("managed-portfolio-review"));
  click(f.render().button("managed-portfolio-save"));
  const signal = vi.mocked(f.api.savePortfolio).mock.calls[0]![1];
  await f.workspace.sessionOwner.signOut();
  expect(signal.aborted).toBe(true);
  finish({
    version: 2,
    payload: (before[2] as typeof draft).ledger!,
    replayed: false,
  });
  await settle();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.session.signOut).toHaveBeenCalledOnce();
});

it("reconciles the original uncertain command and requires explicit saved-version choice", async () => {
  const f = fixture(ledger());
  await approved(f);
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  f.workspace.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "800.00" },
  });
  vi.mocked(f.api.savePortfolio).mockRejectedValueOnce(
    new TrialApiError("commit_unknown"),
  );
  click(f.render().button("managed-portfolio-review"));
  click(f.render().button("managed-portfolio-save"));
  await settle();
  const command = vi.mocked(f.api.savePortfolio).mock.calls[0]![0];
  vi.mocked(f.api.savePortfolio).mockResolvedValueOnce({
    version: 2,
    payload: command.payload,
    replayed: true,
  });
  click(f.render().button("managed-portfolio-reconcile"));
  await settle();
  expect(vi.mocked(f.api.savePortfolio).mock.calls[1]![0]).toEqual(command);
  expect(f.render().button("managed-portfolio-use-saved").disabled).toBe(true);
  f.setStored({
    version: 3,
    payload: {
      ...ledger(),
      opening: { ...ledger().opening, cashUsd: "700.00" },
    },
  });
  click(f.render().button("managed-portfolio-load"));
  await settle();
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("800.00");
  click(f.render().button("managed-portfolio-use-saved"));
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("700.00");
  expect(f.api.savePortfolio).toHaveBeenCalledTimes(2);
});

it("requires a fresh review after Keep draft changes the saved version, including a stale Save callback", async () => {
  const f = fixture(ledger());
  await approved(f);
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  f.workspace.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: { ...draft.ledger!.opening, cashUsd: "800.00" },
  });
  click(f.render().button("managed-portfolio-review"));
  const oldSave = f.render().button("managed-portfolio-save");
  vi.mocked(f.api.savePortfolio).mockRejectedValueOnce(
    new TrialApiError("conflict"),
  );
  click(oldSave);
  await settle();
  const retained = f.workspace.portfolio.coordinator.getSnapshot().draft;
  f.setStored({ version: 2, payload: ledger() });
  click(f.render().button("managed-portfolio-load"));
  await settle();
  click(f.render().button("managed-portfolio-keep-draft"));
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(retained);
  expect(f.workspace.portfolio.coordinator.getSnapshot().baseVersion).toBe(2);
  click(oldSave);
  expect(f.api.savePortfolio).toHaveBeenCalledOnce();
  expect(f.render().button("managed-portfolio-save").disabled).toBe(true);
  click(f.render().button("managed-portfolio-review"));
  click(f.render().button("managed-portfolio-save"));
  await settle();
  expect(f.api.savePortfolio).toHaveBeenCalledTimes(2);
  expect(vi.mocked(f.api.savePortfolio).mock.calls[1]![0]).toMatchObject({
    expectedVersion: 2,
    payload: { opening: { cashUsd: "800.00" } },
  });
});

it("composes authored Start, exact registration, shared-editor Apply, Review, Save and fresh-session reopen", async () => {
  const f = fixture();
  await loaded(f);
  const start = nodes(f.render().tree).find(
    (node) =>
      typeof node.type === "function" && node.type.name === "StartPortfolio",
  )!;
  const renderStart = () => {
    hooks.direct = true;
    hooks.index = 0;
    const tree = (start.type as (props: unknown) => React.ReactNode)(
      start.props,
    );
    hooks.direct = false;
    return {
      tree,
      input: (id: string) =>
        nodes(tree).find((node) => node.props.id === id)!
          .props as React.ComponentProps<"input">,
      button: (id: string) =>
        nodes(tree).find((node) => node.props.id === id)!
          .props as React.ComponentProps<"button">,
    };
  };
  hooks.slots = [];
  renderStart().input("managed-portfolio-opening-date").onChange!({
    currentTarget: { value: "2026-10-01" },
  } as React.ChangeEvent<HTMLInputElement>);
  renderStart().input("managed-portfolio-opening-cash").onChange!({
    currentTarget: { value: "1000.00" },
  } as React.ChangeEvent<HTMLInputElement>);
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(true);
  expect(f.workspace.portfolio.coordinator.getSnapshot().dirty).toBe(false);
  click(renderStart().button("managed-portfolio-start"));
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
  hooks.slots = [];
  f.workspace.setQuery("DEMO");
  await f.workspace.search();
  const register = nodes(f.render().tree).find(
    (node) =>
      node.type === "button" &&
      React.Children.toArray(node.props.children)
        .filter((value) => typeof value === "string")
        .join("") === `Register ${identity.symbol}`,
  )!;
  click(register.props);
  await settle();
  expect(f.api.resolve).toHaveBeenCalledOnce();
  const registered =
    f.workspace.portfolio.coordinator.getSnapshot().draft!.ledger!;
  const buy = {
    id: "buy-one",
    date: "2026-10-02",
    type: "buy" as const,
    listingId: identity.listingId,
    shares: "2",
    grossUsd: "200.00",
    feeUsd: "1.00",
  };
  const sell = {
    id: "sell-one",
    date: "2026-10-02",
    type: "sell" as const,
    listingId: identity.listingId,
    shares: "1",
    grossUsd: "150.00",
    feeUsd: "1.00",
  };
  f.render()
    .editor()
    .onChange({ ...registered, transactions: [buy] });
  f.render()
    .editor()
    .onChange({ ...registered, transactions: [buy, sell] });
  expect(f.workspace.portfolio.getProjection()).toMatchObject({
    status: "valid",
    portfolio: {
      cashUsd: "948.00",
      holdings: [{ shares: "1", totalCostBasisUsd: "100.50" }],
    },
    realized: {
      knownGainSubtotalUsd: "48.50",
      totalGainUsd: "48.50",
      unknownSales: 0,
    },
  });
  expect(f.render().button("managed-portfolio-save").disabled).toBe(true);
  click(f.render().button("managed-portfolio-review"));
  expect(f.render().html).toContain("Review this portfolio draft");
  expect(f.render().html).toContain(identity.issuerName);
  click(f.render().button("managed-portfolio-save"));
  await settle();
  const command = vi.mocked(f.api.savePortfolio).mock.calls[0]![0];
  expect(command.payload.transactions).toEqual([buy, sell]);
  expect(f.api.savePortfolio).toHaveBeenCalledOnce();
  const reopened = new ManagedWorkspace(
    f.api,
    {
      ...f.session,
      sessionId: "invented-fresh-session",
    },
    undefined,
    { researchCoverage: inventedManagedResearchCoverage },
  );
  await reopened.portfolio.coordinator.load();
  expect(reopened.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    command.payload,
  );
  expect(reopened.portfolio.getProjection()).toMatchObject({
    status: "valid",
    portfolio: { cashUsd: "948.00" },
    realized: { totalGainUsd: "48.50" },
  });
  expect(f.api.load).not.toHaveBeenCalled();
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
});

it("warns on browser leave for a clean ledger's pending form without inventing a ledger edit", async () => {
  const f = fixture(ledger());
  await loaded(f);
  const target = new EventTarget();
  const dispose = bindManagedBrowserUnload(f.workspace.sessionOwner, target);
  const event = () => {
    const leave = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(leave);
    return leave;
  };
  expect(event().defaultPrevented).toBe(false);
  const before = f.workspace.portfolio.coordinator.getSnapshot();
  const editor = f.render().editor();
  editor.onPendingEditsChange!(true);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(before);
  expect(before.dirty).toBe(false);
  expect(f.workspace.sessionOwner.getSnapshot().portfolio.dirty).toBe(true);
  expect(event().defaultPrevented).toBe(true);
  editor.onPendingEditsChange!(false);
  expect(event().defaultPrevented).toBe(false);
  dispose();
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
});

it("passes valid-root-route admission to Portfolio file tools even when workspace selection is unchanged", async () => {
  const f = fixture(ledger());
  await f.workspace.refreshCatalog();
  await f.workspace.portfolio.coordinator.load();
  let validRoot = false;
  const draftFiles = {
    draftFileScope: Promise.resolve(`sha256:${"c".repeat(64)}`),
    draftFileRouteActive: () => validRoot,
  };
  const entry = () =>
    nodes(f.render(false, draftFiles).tree).find(
      (node) => node.type === ManagedPortfolioDraftFiles,
    )!;
  const fileProps = entry().props as unknown as React.ComponentProps<
    typeof ManagedPortfolioDraftFiles
  >;
  expect(fileProps.routeActive()).toBe(false);
  validRoot = true;
  expect(fileProps.routeActive()).toBe(true);
  const pending = nodes(f.render(true, draftFiles).tree).find(
    (node) => node.type === ManagedPortfolioDraftFiles,
  )!.props as unknown as React.ComponentProps<
    typeof ManagedPortfolioDraftFiles
  >;
  expect(pending.routeActive()).toBe(false);
  f.workspace.sessionOwner.dispose();
});
