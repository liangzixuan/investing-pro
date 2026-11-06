import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  FinancialScreenPassReviewControls,
  ManagedFinancialScreenPassReview,
} from "./ManagedFinancialScreenPassReview";
import { createWorkspaceScreenPassReview } from "./financial-screen-pass-review-context";
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
const sources: ReturnType<typeof createWorkspaceScreenPassReview>[] = [];
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
    (item) => item.props.id === `managed-screen-pass-review-${suffix}`,
  )!;
}
function click(tree: React.ReactNode, suffix: string) {
  const target = element(tree, suffix);
  expect(target).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  doc.activeElement = nodes.get(`managed-screen-pass-review-${suffix}`)!;
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
  const transport = await createFixture("screen-pass-review");
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
  await vi.advanceTimersByTimeAsync(20000);
  await running;
  let active = true;
  const route = () => active;
  const source = createWorkspaceScreenPassReview(workspace, route);
  sources.push(source);
  let tree: ReturnType<typeof FinancialScreenPassReviewControls> | null = null;
  function render() {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    tree = FinancialScreenPassReviewControls({
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
it("previews both full rows, cancels without effects, then reads exactly one fresh full pass", async () => {
  const f = await fixture(),
    original = f.screen.getSnapshot();
  const counts = f.transport.watchlistScreenSelection!.getSnapshot();
  click(f.tree(), "prepare");
  f.flush();
  expect(f.html()("[data-pass-listing-id]")).toHaveLength(2);
  expect(f.html()("[data-pass-side=previous]")).toHaveLength(2);
  expect(f.html()("[data-pass-side=current]")).toHaveLength(0);
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toBe(counts);
  expect(
    nodes.get("managed-screen-pass-review-preview")!.focus,
  ).toHaveBeenCalledOnce();
  const old = element(f.tree(), "run").props.onClick as () => void;
  click(f.tree(), "cancel");
  f.flush();
  old();
  expect(f.screen.getSnapshot()).toBe(original);
  click(f.tree(), "prepare");
  f.flush();
  click(f.tree(), "run");
  f.flush();
  await vi.advanceTimersByTimeAsync(40000);
  await vi.waitFor(() =>
    expect(f.source.controller.getSnapshot().status).toBe("settled"),
  );
  f.flush();
  const state = f.source.controller.getSnapshot(),
    current = f.screen.getSnapshot();
  expect(state.plan!.sourceRun).toBe(original.run);
  expect(state.result).toBe(current.run);
  expect(current.run!.handle).not.toBe(original.run!.handle);
  const html = f.html();
  expect(html("[data-pass-side=previous]")).toHaveLength(2);
  expect(html("[data-pass-side=current]")).toHaveLength(2);
  for (const run of [original.run!, current.run!]) {
    expect(html.root().text()).toContain(run.startedAt);
    expect(html.root().text()).toContain(run.completedAt!);
    for (const row of run.rows) {
      const text = html(
        '[data-pass-listing-id="' + row.member.listing.listingId + '"]',
      ).text();
      for (const value of Object.values(row.member.listing))
        expect(text).toContain(value);
      for (const metric of Object.values(row.evaluation!.metrics))
        expect(text).toContain(
          metric.status === "unavailable" ? metric.reason : metric.value,
        );
      const response = row.report!.response!;
      for (const value of [
        response.evidence.generation.cutoffAt,
        response.evidence.generation.completedAt,
        response.evidence.generation.sha256,
      ])
        expect(text).toContain(value);
    }
  }
  expect(html.root().text()).toContain(
    "Unavailable or unattempted reads do not establish a nonmatch",
  );
  expect(html.root().text()).toContain(
    "Historical evidence; excluded from current filters",
  );
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toMatchObject({
    annual: 4,
    save: 0,
    rejected: 0,
    unexpected: {},
  });
  click(f.tree(), "cancel");
  f.flush();
  expect(f.screen.getSnapshot()).toBe(current);
  expect(f.source.controller.getSnapshot().plan).toBeNull();
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
    expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(2);
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
    const tree = ManagedFinancialScreenPassReview({
      workspace: f.workspace,
      routeActive: route,
    });
    hooks.effects.splice(0).forEach((effect) => effect());
    return tree as React.ReactElement<
      React.ComponentProps<typeof FinancialScreenPassReviewControls>
    > | null;
  }
  renderOwner();
  const controller = renderOwner()!.props.controller;
  const plan = controller.preview(controller.getSnapshot())!;
  const pending = controller.run(plan);
  await vi.advanceTimersByTimeAsync(40000);
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
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(4);
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
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(2);
  expect(f.screen.getSnapshot().run!.status).toBe("cancelled");
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
    nodes.get("managed-screen-pass-review-preview")!.focus,
  ).not.toHaveBeenCalled();
  const oldRun = element(f.tree(), "run").props.onClick as () => void;
  f.source.dispose();
  oldRun();
  await vi.advanceTimersByTimeAsync(20000);
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(2);
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
  expect(f.transport.watchlistScreenSelection!.getSnapshot().annual).toBe(2);
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
});
