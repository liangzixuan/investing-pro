import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  FinancialScreenRefinementControls,
  ManagedFinancialScreenRefinement,
} from "./ManagedFinancialScreenRefinement";
import { FinancialScreenCriteriaControls } from "./FinancialScreenCriteriaControls";
import { createWorkspaceScreenRefinement } from "./financial-screen-refinement-context";
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
const sources: ReturnType<typeof createWorkspaceScreenRefinement>[] = [];
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
    (item) => item.props.id === `managed-screen-refinement-${suffix}`,
  )!;
}
function click(tree: React.ReactNode, suffix: string) {
  const target = element(tree, suffix);
  expect(target).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  doc.activeElement = nodes.get(`managed-screen-refinement-${suffix}`)!;
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
  const transport = await createFixture("screen-refinement");
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
  const run = screen.run(screen.getSnapshot());
  await vi.advanceTimersByTimeAsync(20000);
  await run;
  let active = true;
  const route = () => active;
  const source = createWorkspaceScreenRefinement(workspace, route);
  sources.push(source);
  const onApplied = vi.fn();
  let tree: ReturnType<typeof FinancialScreenRefinementControls> | null = null;
  function render() {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    tree = FinancialScreenRefinementControls({
      workspace,
      controller: source.controller,
      routeActive: route,
      onApplied,
    });
    attach(tree);
    hooks.effects.splice(0).forEach((effect) => effect());
    return tree;
  }
  function flush() {
    if (hooks.dirty) render();
    return tree;
  }
  function change(value: string) {
    const controls = elements(tree).find(
      (e) => e.type === FinancialScreenCriteriaControls,
    )!;
    const draft = controls.props.draft as React.ComponentProps<
      typeof FinancialScreenCriteriaControls
    >["draft"];
    (controls.props.edit as (value: typeof draft) => void)({
      ...draft,
      clauses: [{ field: "operatingCashFlow", operator: "gte", value }],
    });
    flush();
  }
  function prepare() {
    const form = elements(tree).find(
      (e) => e.props.className === "managed-screen-refinement-draft",
    )!;
    doc.activeElement = nodes.get("managed-screen-refinement-prepare")!;
    (form.props.onSubmit as (e: { preventDefault: () => void }) => void)({
      preventDefault: vi.fn(),
    });
    flush();
  }
  render();
  click(tree, "open");
  flush();
  return {
    workspace,
    screen,
    source,
    transport,
    onApplied,
    render,
    flush,
    change,
    prepare,
    tree: () => tree,
    html: () => load(renderToStaticMarkup(tree)),
    route: (value: boolean) => {
      active = value;
      render();
    },
  };
}
it("previews complete original/revised fields and clauses without effects, applies once and clears only the comparison afterward", async () => {
  const f = await fixture();
  const original = f.screen.getSnapshot();
  const counts = f.transport.watchlistScreenSelection!.getSnapshot();
  f.change("bad");
  f.prepare();
  expect(f.source.controller.getSnapshot().reading).toBeNull();
  expect(f.screen.getSnapshot()).toBe(original);
  f.change("1100.00");
  f.prepare();
  const reading = f.source.controller.getSnapshot().reading!;
  expect(reading).not.toBeNull();
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toBe(counts);
  const html = f.html();
  expect(html("[data-refinement-listing-id]")).toHaveLength(2);
  expect(html("[data-refinement-clause]")).toHaveLength(4);
  expect(html("[data-refinement-field]")).toHaveLength(24);
  expect(
    html("[data-refinement-side=revised] h5")
      .map((_, e) => html(e).text())
      .get(),
  ).toEqual(["Revised result: nonmatch", "Revised result: unknown"]);
  for (const row of reading.rows) {
    const text = html(
      `[data-refinement-listing-id="${row.original.member.listing.listingId}"]`,
    ).text();
    for (const value of Object.values(row.original.member.listing))
      expect(text).toContain(value);
    expect(text).toContain(
      row.original.report!.response!.evidence.generation.cutoffAt,
    );
    for (const metric of Object.values(row.revised!.metrics))
      expect(text).toContain(
        metric.status === "unavailable" ? metric.reason : metric.value,
      );
  }
  expect(html("[data-refinement-clause]").text()).toContain("At least 1100.00");
  expect(
    nodes.get("managed-screen-refinement-preview")!.focus,
  ).toHaveBeenCalledOnce();
  const oldApply = element(f.tree(), "apply").props.onClick as () => void;
  click(f.tree(), "apply");
  f.flush();
  expect(f.onApplied).toHaveBeenCalledOnce();
  expect(f.screen.getSnapshot().run!.startedAt).toBe(original.run!.startedAt);
  expect(f.screen.getSnapshot().run!.refinedAt).toBe(reading.evaluatedAt);
  expect(
    nodes.get("managed-screen-refinement-heading")!.focus,
  ).toHaveBeenCalledTimes(2);
  expect(f.html()("#managed-screen-refinement-cancel").text()).toBe(
    "Clear comparison",
  );
  const applied = f.screen.getSnapshot();
  click(f.tree(), "cancel");
  f.flush();
  oldApply();
  expect(f.screen.getSnapshot()).toBe(applied);
  expect(f.source.controller.getSnapshot().reading).toBeNull();
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toBe(counts);
});
it("cancel and raw edits consume the preview while preserving original screen, pair and shortlist", async () => {
  const f = await fixture();
  const run = f.screen.getSnapshot().run!;
  f.screen.toggleShortlist(f.screen.getSnapshot(), run.rows[0]!);
  f.screen.selectComparison(f.screen.getSnapshot(), "left", run.rows[0]!);
  f.screen.selectComparison(f.screen.getSnapshot(), "right", run.rows[1]!);
  f.render();
  const original = f.screen.getSnapshot();
  f.change("1100.00");
  f.prepare();
  const old = element(f.tree(), "apply").props.onClick as () => void;
  f.change("1200.00");
  old();
  expect(f.screen.getSnapshot()).toBe(original);
  f.prepare();
  click(f.tree(), "cancel");
  f.flush();
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.source.controller.getSnapshot().reading).toBeNull();
});
it.each(["navigation", "file", "notes", "route"] as const)(
  "irrevocably retires the exact preview after %s changes",
  async (kind) => {
    const f = await fixture();
    f.change("1100.00");
    f.prepare();
    const original = f.screen.getSnapshot();
    const old = element(f.tree(), "apply").props.onClick as () => void;
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
      f.workspace.note(portfolioScreenIds.apple, "New independent raw note");
    if (kind === "route") {
      f.route(false);
      f.route(true);
    }
    const settled = f.screen.getSnapshot();
    f.flush();
    old();
    expect(f.screen.getSnapshot()).toBe(settled);
    expect(settled.run).toBe(original.run);
    expect(settled.criteria).toBe(original.criteria);
    expect(f.source.controller.getSnapshot().status).toBe("stale");
    expect(element(f.tree(), "apply").props.disabled).toBe(true);
  },
);

it("refuses disposed callbacks without changing retained reports or resources", async () => {
  const f = await fixture();
  const counts = f.transport.watchlistScreenSelection!.getSnapshot();
  const original = f.screen.getSnapshot();
  f.change("1100.00");
  f.prepare();
  expect(f.source.controller.getSnapshot().canApply).toBe(true);
  const old = element(f.tree(), "apply").props.onClick as () => void;
  f.source.dispose();
  old();
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.transport.watchlistScreenSelection!.getSnapshot()).toBe(counts);
});

it("keeps an applied passive reading when the mounted route callback changes across navigation", async () => {
  const f = await fixture();
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  let route = () => true;
  function renderOwner() {
    hooks.index = 0;
    hooks.effects = [];
    const result = ManagedFinancialScreenRefinement({
      workspace: f.workspace,
      routeActive: route,
      onApplied: vi.fn(),
    });
    hooks.effects.splice(0).forEach((effect) => effect());
    return result as React.ReactElement<
      React.ComponentProps<typeof FinancialScreenRefinementControls>
    > | null;
  }
  renderOwner();
  const tree = renderOwner()!;
  const controller = tree.props.controller;
  const criteria = {
    clauses: [
      { field: "operatingCashFlow", operator: "gte", value: "1100.00" },
    ],
    sort: { field: "symbol", direction: "asc" },
  };
  const prepared = controller.preview(controller.getSnapshot(), criteria)!;
  expect(controller.apply(prepared)).not.toBeNull();
  const applied = controller.getSnapshot();
  f.workspace.setView("watchlist");
  route = () => false;
  expect(renderOwner()!.props.controller).toBe(controller);
  expect(controller.getSnapshot()).toBe(applied);
  f.workspace.setView("discover");
  route = () => true;
  expect(renderOwner()!.props.controller).toBe(controller);
  expect(controller.getSnapshot()).toBe(applied);
});

it("does not take focus from a later action during accepted Apply", async () => {
  const f = await fixture();
  f.change("1100.00");
  f.prepare();
  const other = { focus: vi.fn(), isConnected: true };
  f.onApplied.mockImplementation(() => {
    doc.activeElement = other;
  });
  click(f.tree(), "apply");
  f.flush();
  expect(f.source.controller.getSnapshot().status).toBe("applied");
  expect(doc.activeElement).toBe(other);
  expect(
    nodes.get("managed-screen-refinement-heading")!.focus,
  ).toHaveBeenCalledOnce();
});
