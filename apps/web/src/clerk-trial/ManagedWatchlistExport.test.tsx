import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import { ManagedWatchlistExport } from "./ManagedWatchlistExport";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import type {
  WatchlistExportDeliveryAdapter,
  WatchlistExportDeliveryResult,
} from "./watchlist-export-delivery";

// Controlled hooks exercise the real coordinator and operation lifetime. Browser
// and native journeys separately establish DOM focus and actual file delivery.
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  callbackIndex: 0,
  callbacks: [] as Array<{ deps: React.DependencyList; callback: unknown }>,
  updates: 0,
  effects: [] as Array<{
    deps: React.DependencyList | undefined;
    cleanup: (() => void) | void;
  }>,
  tasks: [] as Array<() => void>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (value: unknown) => {
        hooks.states[index] = value;
        hooks.updates++;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useCallback: (callback: unknown, deps: React.DependencyList) => {
    const index = hooks.callbackIndex++;
    const previous = hooks.callbacks[index];
    if (
      !previous ||
      deps.some((value, position) => value !== previous.deps[position])
    )
      hooks.callbacks[index] = { deps, callback };
    return hooks.callbacks[index]!.callback;
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useLayoutEffect: (
    effect: () => (() => void) | void,
    deps?: React.DependencyList,
  ) => {
    const index = hooks.effectIndex++;
    const previous = hooks.effects[index];
    if (
      !previous ||
      !deps ||
      deps.some((value, position) => value !== previous.deps?.[position])
    ) {
      hooks.tasks.push(() => {
        previous?.cleanup?.();
        hooks.effects[index] = { deps, cleanup: effect() };
      });
    }
  },
}));

const payload: MainWatchlistPayload = {
  schemaVersion: 1,
  name: "My Watchlist",
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  memberships: ["A", "C"].map((shareClassName) => ({
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-invented",
    issuerName: "Invented Company",
    listingId: `listing-${shareClassName}`,
    securityId: `security-${shareClassName}`,
    securityName: `Invented Class ${shareClassName}`,
    shareClassId: `class-${shareClassName}`,
    shareClassName: `Class ${shareClassName}`,
    symbol: `INV${shareClassName}`,
    note: `Saved ${shareClassName} note Café 😀`,
  })),
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
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}

function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<{ children?: React.ReactNode }>(node)
    ? text(node.props.children)
    : "";
}

function fixture(initial = payload) {
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
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockRejectedValue(new Error("Unexpected announcements read")),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn(),
    eodHistory: vi.fn(),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>(),
    annualReport: vi.fn(),
    status: vi.fn(),
    search: vi.fn(),
    resolve: vi.fn(),
    save: vi.fn(),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 3, payload: initial }),
  };
  const session = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
  const workspace = new ManagedWorkspace(api, session, undefined, {
    researchCoverage: inventedManagedResearchCoverage,
  });
  workspace.setView("watchlist");
  const deliver = vi
    .fn<WatchlistExportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  let props: React.ComponentProps<typeof ManagedWatchlistExport> = {
    workspace,
    delivery: { deliver },
    routeActive: () => true,
  };
  const render = () => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    hooks.effectIndex = 0;
    hooks.callbackIndex = 0;
    const output = elements(ManagedWatchlistExport(props));
    hooks.tasks.splice(0).forEach((task) => task());
    const control = output.find(
      (entry) => entry.props.id === "managed-watchlist-export",
    )!;
    return {
      disabled: control.props.disabled,
      busy: control.props["aria-disabled"],
      click: control.props.onClick as () => void,
      scope: text(
        output.find(
          (entry) => entry.props.id === "managed-watchlist-export-scope",
        ),
      ),
      status: text(
        output.find(
          (entry) => entry.props.id === "managed-watchlist-export-status",
        ),
      ),
    };
  };
  const noAddedRequests = () => {
    expect(api.load).toHaveBeenCalledOnce();
    for (const method of [
      api.save,
      api.status,
      api.search,
      api.resolve,
      api.annualReport,
      api.eodHistory,
      api.economicCalendar,
      session.getToken,
    ])
      expect(method).not.toHaveBeenCalled();
  };
  return {
    workspace,
    api,
    deliver,
    render,
    noAddedRequests,
    props: (change: Partial<typeof props>) => {
      props = { ...props, ...change };
    },
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}
function unmount() {
  hooks.effects.forEach((effect) => effect.cleanup?.());
  hooks.effects = [];
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.tasks = [];
  hooks.callbacks = [];
  hooks.updates = 0;
});
afterEach(unmount);

describe("saved watchlist export control", () => {
  it("explains missing saved data and refuses a stale disabled handler", async () => {
    const test = fixture();
    const unloaded = test.render();
    expect(unloaded.disabled).toBe(true);
    expect(unloaded.scope).toContain("Load a saved watchlist");
    unloaded.click();
    expect(test.deliver).not.toHaveBeenCalled();
    await test.workspace.coordinator.load();
    test.props({ delivery: undefined });
    expect(test.render().scope).toContain("unavailable in this client");
    test.render().click();
    expect(test.deliver).not.toHaveBeenCalled();
  });

  it("exports every saved member in order while preserving all invalid and reordered draft bytes", async () => {
    const test = fixture();
    await test.workspace.coordinator.load();
    const draft = {
      ...payload,
      memberships: [...payload.memberships]
        .reverse()
        .map((entry) => ({ ...entry, note: `  unsaved\n${entry.symbol}  ` })),
    };
    test.workspace.coordinator.replaceDraft(draft);
    const before = JSON.stringify(
      test.workspace.coordinator.getSnapshot().draft,
    );
    const view = test.render();
    expect(view.disabled).toBe(false);
    expect(view.scope).toContain(
      "Saved version 3 · all 2 listings. Unsaved changes are not included.",
    );
    view.click();
    await settle();
    const document = test.deliver.mock.calls[0]![0];
    expect(document.membershipCount).toBe(2);
    expect(document.text.indexOf("Symbol: INVA")).toBeLessThan(
      document.text.indexOf("Symbol: INVC"),
    );
    for (const entry of payload.memberships)
      expect(document.text).toContain(entry.note);
    expect(document.text).not.toContain("unsaved\n");
    expect(JSON.stringify(test.workspace.coordinator.getSnapshot().draft)).toBe(
      before,
    );
    expect(test.render().status).toBe("Exported saved version 3.");
    test.noAddedRequests();
  });

  it("keeps the busy control focusable, guards duplicate activation and retains a pending copy across draft/query changes", async () => {
    const test = fixture();
    await test.workspace.coordinator.load();
    const pending = deferred<WatchlistExportDeliveryResult>();
    test.deliver.mockReturnValue(pending.promise);
    test.render().click();
    const busy = test.render();
    expect(busy.disabled).toBe(false);
    expect(busy.busy).toBe(true);
    busy.click();
    test.workspace.coordinator.replaceDraft({ ...payload, memberships: [] });
    test.workspace.setQuery("other presentation query");
    const context = test.deliver.mock.calls[0]![1];
    expect(context.signal.aborted).toBe(false);
    expect(context.isCurrent()).toBe(true);
    pending.resolve("download_requested");
    await settle();
    expect(test.deliver).toHaveBeenCalledOnce();
    expect(test.render().status).toBe(
      "Download requested for saved version 3.",
    );
    test.noAddedRequests();
  });

  it.each(["conflict", "commit_unknown"] as const)(
    "withholds export for an unresolved %s save",
    async (code) => {
      const test = fixture();
      vi.mocked(test.api.status).mockResolvedValue({ snapshot });
      await test.workspace.refreshCatalog();
      await test.workspace.coordinator.load();
      test.workspace.coordinator.replaceDraft({ ...payload, memberships: [] });
      vi.mocked(test.api.save).mockRejectedValue(new TrialApiError(code));
      await test.workspace.coordinator.save();
      expect(test.api.save).toHaveBeenCalledOnce();
      const view = test.render();
      expect(view.disabled).toBe(true);
      view.click();
      expect(test.deliver).not.toHaveBeenCalled();
      expect(view.scope).toContain(
        code === "conflict"
          ? "Choose which watchlist"
          : "Reconcile the pending save",
      );
    },
  );

  it("cancels a pending export when loading replaces its saved version and fences the old completion from a later export", async () => {
    const test = fixture();
    await test.workspace.coordinator.load();
    const first = deferred<WatchlistExportDeliveryResult>();
    const second = deferred<WatchlistExportDeliveryResult>();
    test.deliver
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    test.render().click();
    const old = test.deliver.mock.calls[0]![1];
    vi.mocked(test.api.load).mockResolvedValueOnce({ version: 4, payload });
    await test.workspace.coordinator.load();
    expect(old.signal.aborted).toBe(true);
    expect(old.isCurrent()).toBe(false);
    test.render().click();
    expect(test.deliver.mock.calls[1]![0].version).toBe(4);
    first.resolve("written");
    await settle();
    expect(test.render().status).toBe("");
    second.resolve("written");
    await settle();
    expect(test.render().status).toBe("Exported saved version 4.");
  });

  it.each(["view", "retire", "route"])(
    "fences pending and stale actions after %s retirement",
    async (kind) => {
      const test = fixture();
      await test.workspace.coordinator.load();
      const pending = deferred<WatchlistExportDeliveryResult>();
      test.deliver.mockReturnValue(pending.promise);
      const oldView = test.render();
      oldView.click();
      const context = test.deliver.mock.calls[0]![1];
      if (kind === "view") test.workspace.setView("discover");
      else if (kind === "retire") test.workspace.coordinator.retire();
      else {
        test.props({ routeActive: () => false });
        test.render();
      }
      expect(context.signal.aborted).toBe(true);
      expect(context.isCurrent()).toBe(false);
      oldView.click();
      pending.resolve("written");
      await settle();
      expect(test.deliver).toHaveBeenCalledOnce();
      expect(test.render().status).toBe("");
    },
  );

  it("aborts on unmount and ignores a late rejected callback", async () => {
    const test = fixture();
    await test.workspace.coordinator.load();
    const pending = deferred<WatchlistExportDeliveryResult>();
    test.deliver.mockReturnValue(pending.promise);
    test.render().click();
    const context = test.deliver.mock.calls[0]![1];
    unmount();
    const updates = hooks.updates;
    pending.reject(new Error("private native error"));
    await settle();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    expect(hooks.updates).toBe(updates);
  });

  it("cancels the old delivery when its adapter is replaced and permits the new adapter", async () => {
    const test = fixture();
    await test.workspace.coordinator.load();
    const pending = deferred<WatchlistExportDeliveryResult>();
    test.deliver.mockReturnValue(pending.promise);
    test.render().click();
    const context = test.deliver.mock.calls[0]![1];
    const deliver = vi
      .fn<WatchlistExportDeliveryAdapter["deliver"]>()
      .mockResolvedValue("written");
    test.props({ delivery: { deliver } });
    test.render();
    expect(context.signal.aborted).toBe(true);
    expect(test.render().busy).toBe(false);
    test.render().click();
    await settle();
    expect(deliver).toHaveBeenCalledOnce();
    pending.resolve("written");
    await settle();
    expect(test.render().status).toBe("Exported saved version 3.");
    test.noAddedRequests();
  });

  it.each(["cancelled", "failed"])(
    "reports a bounded %s outcome without changing the draft or requesting data",
    async (outcome) => {
      const test = fixture();
      await test.workspace.coordinator.load();
      const before = JSON.stringify(test.workspace.coordinator.getSnapshot());
      if (outcome === "cancelled") test.deliver.mockResolvedValue("cancelled");
      else
        test.deliver.mockRejectedValue(
          new Error("private note, path and account"),
        );
      test.render().click();
      await settle();
      expect(test.render().status).toContain(
        outcome === "cancelled"
          ? "Export cancelled."
          : "Export could not be completed.",
      );
      expect(test.render().status).not.toContain("private note");
      expect(JSON.stringify(test.workspace.coordinator.getSnapshot())).toBe(
        before,
      );
      test.noAddedRequests();
    },
  );
});
