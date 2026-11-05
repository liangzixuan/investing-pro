import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  FinancialScreenContinuationControls,
  ManagedFinancialScreenContinuation,
} from "./ManagedFinancialScreenContinuation";
import { createWorkspaceScreenContinuation } from "./financial-screen-continuation-context";
import { ManagedWorkspace } from "./managed-workspace";
import { prepareWatchlistScreenSelection } from "./managed-watchlist-screen-selection";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { portfolioScreenIds } from "../../android-tests/managed-workspace/portfolio-screen-selection-fixture-data";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  dirty: false,
  subscriptions: new Map<unknown, () => void>(),
}));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  const mocked = createValuationDraftTestHooks(hooks);
  return {
    ...(await original<typeof React>()),
    ...mocked,
    useState(initial: unknown) {
      const [value, set] = mocked.useState(
        typeof initial === "function" ? (initial as () => unknown)() : initial,
      );
      return [
        value,
        (next: unknown) => {
          (set as (next: unknown) => void)(next);
          hooks.dirty = true;
        },
      ];
    },
    useSyncExternalStore(
      subscribe: (listener: () => void) => () => void,
      snapshot: () => unknown,
    ) {
      if (!hooks.subscriptions.has(subscribe)) {
        let previous = snapshot();
        hooks.subscriptions.set(
          subscribe,
          subscribe(() => {
            const next = snapshot();
            if (next !== previous) hooks.dirty = true;
            previous = next;
          }),
        );
      }
      return snapshot();
    },
  };
});
type Element = React.ReactElement<Record<string, unknown>>;
type FocusNode = { focus: ReturnType<typeof vi.fn>; isConnected: boolean };
const nodes = new Map<string, FocusNode>();
const doc: { activeElement: FocusNode | null; body: FocusNode } = {
  activeElement: null,
  body: { focus: vi.fn(), isConnected: true },
};
const owners: ManagedWorkspace[] = [];
const sources: ReturnType<typeof createWorkspaceScreenContinuation>[] = [];
function elements(value: React.ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as React.ReactNode)];
}
function attach(tree: React.ReactNode) {
  const present = new Set<string>();
  for (const element of elements(tree)) {
    const id = element.props.id;
    if (typeof id !== "string") continue;
    present.add(id);
    let node = nodes.get(id);
    if (!node) {
      node = { focus: vi.fn(), isConnected: true };
      node.focus.mockImplementation(() => {
        doc.activeElement = node!;
      });
      nodes.set(id, node);
    }
    node.isConnected = true;
    const ref = element.props.ref as { current: FocusNode | null } | undefined;
    if (ref) ref.current = node;
  }
  for (const [id, node] of nodes)
    if (!present.has(id)) {
      node.isConnected = false;
      if (doc.activeElement === node) doc.activeElement = doc.body;
    }
}
function element(tree: React.ReactNode, suffix: string) {
  return elements(tree).find(
    (item) => item.props.id === `managed-screen-continuation-${suffix}`,
  )!;
}
function click(tree: React.ReactNode, suffix: string) {
  const target = element(tree, suffix);
  expect(target).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  doc.activeElement = nodes.get(`managed-screen-continuation-${suffix}`)!;
  (target.props.onClick as () => void)();
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  hooks.dirty = false;
  nodes.clear();
  doc.activeElement = doc.body;
  vi.stubGlobal("document", doc);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  hooks.subscriptions.forEach((off) => off());
  hooks.subscriptions.clear();
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  sources.splice(0).forEach((source) => source.dispose());
  owners.splice(0).forEach((owner) => owner.sessionOwner.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture() {
  const transport = await createFixture("screen-continuation");
  const workspace = new ManagedWorkspace(
    transport.api,
    transport.session,
    undefined,
    { researchCoverage: transport.researchCoverage },
  );
  owners.push(workspace);
  workspace.setView("watchlist");
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  workspace.setView("discover");
  const screen = workspace.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), {
    clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0.00" }],
    sort: { field: "symbol", direction: "asc" },
  });
  const member = screen
    .getSnapshot()
    .memberships.find((m) => m.listing.listingId === portfolioScreenIds.googl)!;
  expect(
    prepareWatchlistScreenSelection(workspace, () => true, [
      member,
    ]).preview!.apply(),
  ).not.toBeNull();
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  const running = screen.run(screen.getSnapshot());
  await vi.waitFor(() =>
    expect(screen.getSnapshot().run?.rows[0]?.evaluation).not.toBeNull(),
  );
  screen.cancel();
  await running;
  let active = true;
  const route = () => active;
  const source = createWorkspaceScreenContinuation(workspace, route);
  sources.push(source);
  let tree: ReturnType<typeof FinancialScreenContinuationControls> | null =
    null;
  function render() {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    tree = FinancialScreenContinuationControls({
      workspace,
      controller: source.controller,
      routeActive: route,
    });
    attach(tree);
    hooks.effects.splice(0).forEach((effect) => effect());
    return tree;
  }
  function flush() {
    if (hooks.dirty) render();
    return tree;
  }
  render();
  return {
    workspace,
    screen,
    source,
    transport,
    render,
    flush,
    tree: () => tree,
    html: () => load(renderToStaticMarkup(tree)),
    route: (value: boolean) => {
      active = value;
      render();
    },
  };
}
it("previews all exact retained/missing rows with no request, then explicitly reads only the finite missing list", async () => {
  const f = await fixture();
  const original = f.screen.getSnapshot();
  const counts = f.transport.watchlistScreenSelection!.getSnapshot();
  expect(counts.annual).toBe(1);
  click(f.tree(), "prepare");
  f.flush();
  const plan = f.source.controller.getSnapshot().plan!;
  expect(plan.rows.map((r) => r.disposition)).toEqual(["retained", "missing"]);
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toBe(counts);
  const html = f.html();
  expect(html("[data-continuation-listing-id]")).toHaveLength(2);
  expect(
    html('[aria-label="Reviewed missing Annual requests"] li'),
  ).toHaveLength(1);
  expect(
    html('[aria-label="Reviewed missing Annual requests"]').text(),
  ).toContain(portfolioScreenIds.googl);
  for (const item of plan.rows) {
    const text = html(
      `[data-continuation-listing-id="${item.row.member.listing.listingId}"]`,
    ).text();
    for (const value of Object.values(item.row.member.listing))
      expect(text).toContain(value);
    const response = item.row.report?.response;
    if (response) {
      for (const value of [
        response.evidence.generation.cutoffAt,
        response.evidence.generation.completedAt,
        response.evidence.generation.sha256,
      ])
        expect(text).toContain(value);
      for (const metric of Object.values(item.row.evaluation!.metrics))
        expect(text).toContain(
          metric.status === "unavailable" ? metric.reason : metric.value,
        );
    }
  }
  expect(
    nodes.get("managed-screen-continuation-preview")!.focus,
  ).toHaveBeenCalledOnce();
  const staleRun = element(f.tree(), "run").props.onClick as () => void;
  click(f.tree(), "run");
  f.flush();
  staleRun();
  expect(f.source.controller.getSnapshot().status).toBe("running");
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
  await vi.advanceTimersByTimeAsync(20000);
  await vi.waitFor(() =>
    expect(f.source.controller.getSnapshot().status).toBe("settled"),
  );
  f.flush();
  const current = f.screen.getSnapshot();
  expect(f.source.controller.getSnapshot().status).toBe("settled");
  expect(current.run!.rows[0]!.report).toBe(original.run!.rows[0]!.report);
  expect(current.run!.rows.map((r) => r.report!.response)).toEqual(
    f.transport.watchlistScreenSelection!.packets,
  );
  expect(current.run!.startedAt).toBe(original.run!.startedAt);
  expect(current.run!.completedAt).toBe(original.run!.completedAt);
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toMatchObject({
    annual: 2,
    save: 0,
    rejected: 0,
    unexpected: {},
  });
  const pass = current.run!.continuations!.at(-1)!;
  const after = f.html();
  expect(after("[data-continuation-pass]")).toHaveLength(1);
  for (const value of [
    pass.startedAt,
    pass.completedAt!,
    pass.attempts[0]!.startedAt,
    pass.attempts[0]!.completedAt,
    pass.attempts[0]!.evaluatedAt!,
  ])
    expect(after("[data-continuation-pass]").text()).toContain(value);
  expect(after("[data-continuation-attempt]").text()).toContain(
    "Historical evidence; excluded from current filters",
  );
  expect(after("#managed-screen-continuation-cancel").text()).toBe(
    "Clear continuation reading",
  );
  click(f.tree(), "cancel");
  f.flush();
  expect(f.screen.getSnapshot()).toBe(current);
  expect(f.source.controller.getSnapshot().plan).toBeNull();
});
it("preview Cancel preserves the exact screen, and running Cancel preserves completed packets without dispatching queued reads", async () => {
  const f = await fixture();
  const original = f.screen.getSnapshot();
  click(f.tree(), "prepare");
  f.flush();
  const old = element(f.tree(), "run").props.onClick as () => void;
  click(f.tree(), "cancel");
  f.flush();
  old();
  expect(f.screen.getSnapshot()).toBe(original);
  click(f.tree(), "prepare");
  f.flush();
  click(f.tree(), "run");
  f.flush();
  click(f.tree(), "cancel");
  f.flush();
  await vi.advanceTimersByTimeAsync(20000);
  f.flush();
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
  expect(f.source.controller.getSnapshot().result!.rows[0]!.report).toBe(
    original.run!.rows[0]!.report,
  );
  expect(
    f.source.controller.getSnapshot().result!.continuations!.at(-1)!.status,
  ).toBe("cancelled");
  expect(f.screen.canContinue(f.screen.getSnapshot())).toBe(true);
});
it.each(["navigation", "file", "notes", "route"] as const)(
  "permanently retires preview after %s change",
  async (kind) => {
    const f = await fixture();
    click(f.tree(), "prepare");
    f.flush();
    const old = element(f.tree(), "run").props.onClick as () => void;
    if (kind === "navigation") {
      f.workspace.setView("watchlist");
      f.workspace.setView("discover");
    }
    if (kind === "file") {
      const owner = {};
      f.workspace.beginWatchlistDraftFileActivity(owner);
      f.workspace.endWatchlistDraftFileActivity(owner);
    }
    if (kind === "notes")
      f.workspace.note(portfolioScreenIds.apple, "new raw independent note");
    if (kind === "route") {
      f.route(false);
      f.route(true);
    }
    f.flush();
    old();
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.source.controller.getSnapshot().status).toBe("stale");
    expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
  },
);
it("keeps settled passive data through mounted route replacement and Research/Back", async () => {
  const f = await fixture();
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  let route = () => true;
  function renderOwner() {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedFinancialScreenContinuation({
      workspace: f.workspace,
      routeActive: route,
    });
    hooks.effects.splice(0).forEach((effect) => effect());
    return tree as React.ReactElement<
      React.ComponentProps<typeof FinancialScreenContinuationControls>
    > | null;
  }
  renderOwner();
  const controller = renderOwner()!.props.controller;
  const plan = controller.preview(controller.getSnapshot())!;
  const pending = controller.run(plan);
  await vi.advanceTimersByTimeAsync(20000);
  await pending;
  const settled = controller.getSnapshot();
  const run = f.screen.getSnapshot().run!,
    row = run.rows[1]!;
  f.workspace.openFinancialScreenReport({
    run,
    row,
    response: row.report!.response!,
  });
  await vi.waitFor(() =>
    expect(f.workspace.annual.getSnapshot().response).toEqual(
      row.report!.response,
    ),
  );
  route = () => false;
  expect(renderOwner()!.props.controller).toBe(controller);
  expect(controller.getSnapshot()).toBe(settled);
  f.workspace.closeResearch();
  route = () => true;
  expect(renderOwner()!.props.controller).toBe(controller);
  expect(controller.getSnapshot()).toBe(settled);
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(2);
});
it("file activity during the queued pass cancels authority before another dispatch", async () => {
  const f = await fixture();
  click(f.tree(), "prepare");
  f.flush();
  click(f.tree(), "run");
  f.flush();
  const owner = {};
  f.workspace.beginWatchlistDraftFileActivity(owner);
  f.workspace.endWatchlistDraftFileActivity(owner);
  await vi.advanceTimersByTimeAsync(20000);
  f.flush();
  expect(f.source.controller.getSnapshot().status).toBe("stale");
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
  expect(f.screen.getSnapshot().run!.continuations!.at(-1)!.status).toBe(
    "cancelled",
  );
});

it("does not move focus after a later user action or let a stale rendered callback start work", async () => {
  const f = await fixture();
  const oldPrepare = element(f.tree(), "prepare").props.onClick as () => void;
  f.render();
  oldPrepare();
  expect(f.source.controller.getSnapshot().plan).toBeNull();
  click(f.tree(), "prepare");
  const other = { focus: vi.fn(), isConnected: true };
  doc.activeElement = other;
  f.flush();
  expect(doc.activeElement).toBe(other);
  expect(
    nodes.get("managed-screen-continuation-preview")!.focus,
  ).not.toHaveBeenCalled();
  const oldRun = element(f.tree(), "run").props.onClick as () => void;
  f.source.dispose();
  oldRun();
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
});
it("refuses preview and dispatch after session retirement", async () => {
  const f = await fixture();
  click(f.tree(), "prepare");
  f.flush();
  const oldRun = element(f.tree(), "run").props.onClick as () => void;
  f.workspace.sessionOwner.dispose();
  f.flush();
  oldRun();
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.source.controller.getSnapshot().status).toBe("stale");
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(1);
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
});
