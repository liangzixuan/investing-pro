import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedWatchlistScreenSelection } from "./ManagedWatchlistScreenSelection";
import { watchlistScreenFixture } from "./test-watchlist-screen-selection-fixture";
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
      const [value, set] = mocked.useState(initial);
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
const fixtures: Awaited<ReturnType<typeof watchlistScreenFixture>>[] = [];
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
    (item) => item.props.id === `managed-watchlist-screen-${suffix}`,
  )!;
}
function click(tree: React.ReactNode, suffix: string) {
  const target = element(tree, suffix);
  expect(target).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  doc.activeElement = nodes.get(`managed-watchlist-screen-${suffix}`)!;
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
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture(loadWatchlist = true, loadCohort = true) {
  const f = await watchlistScreenFixture(loadWatchlist, loadCohort);
  fixtures.push(f);
  let tree: ReturnType<typeof ManagedWatchlistScreenSelection> = null;
  const route = () => true;
  function render(commit = true) {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    const next = ManagedWatchlistScreenSelection({
      workspace: f.workspace,
      routeActive: route,
    });
    if (commit) {
      tree = next;
      attach(next);
      hooks.effects.splice(0).forEach((effect) => effect());
    }
    return next;
  }
  function flush() {
    if (hooks.dirty) render();
    return tree;
  }
  const choose = (value = f.choice().listing.listingId) => {
    const control = element(tree, "choice-0");
    (
      control.props.onChange as (event: {
        currentTarget: { value: string };
      }) => void
    )({ currentTarget: { value } });
    flush();
  };
  render();
  return {
    ...f,
    render,
    flush,
    choose,
    tree: () => tree,
    html: () => load(renderToStaticMarkup(tree)),
  };
}

it("requires an explicit watched class, previews the whole ordered replacement and applies without source or Watchlist effects", async () => {
  const f = await fixture();
  const before = f.workspace.coordinator.getSnapshot();
  const criteria = f.workspace.financialScreen.getSnapshot().criteria;
  expect(f.html()("#managed-watchlist-screen-current-count").text()).toContain(
    "4 entries",
  );
  expect(f.html()("[data-watchlist-outcome=outside_cohort]")).toHaveLength(1);
  expect(f.html()("[data-watchlist-outcome=uncovered]")).toHaveLength(1);
  expect(f.html()("dd").text()).toContain("listing-outside");
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  expect(
    nodes.get("managed-watchlist-screen-preview")!.focus,
  ).toHaveBeenCalledOnce();
  expect(f.html()("#managed-watchlist-screen-selected li")).toHaveLength(1);
  expect(f.html()("#managed-watchlist-screen-selected").text()).toContain(
    "ZEROC",
  );
  expect(
    f.html()("#managed-watchlist-screen-preview-rows-count").text(),
  ).toContain("4 entries");
  click(f.tree(), "apply");
  f.flush();
  expect(f.workspace.financialScreen.getSnapshot().selected).toEqual([
    f.choice(),
  ]);
  expect(f.workspace.financialScreen.getSnapshot().criteria).toBe(criteria);
  expect(f.workspace.coordinator.getSnapshot()).toBe(before);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(
    nodes.get("managed-watchlist-screen-heading")!.focus,
  ).toHaveBeenCalledOnce();
  expect(f.html()("#managed-watchlist-screen-message").text()).toContain(
    "Run screen separately",
  );
});
it("cancel and changed notes retire the exact preview without changing the current screen", async () => {
  const f = await fixture();
  f.choose();
  const before = f.workspace.financialScreen.getSnapshot();
  click(f.tree(), "prepare");
  f.flush();
  const stale = element(f.tree(), "apply").props.onClick as () => void;
  click(f.tree(), "cancel");
  f.flush();
  stale();
  f.flush();
  expect(f.workspace.financialScreen.getSnapshot()).toBe(before);
  click(f.tree(), "prepare");
  f.flush();
  const oldApply = element(f.tree(), "apply").props.onClick as () => void;
  f.workspace.note(f.choice().listing.listingId, "New unsaved note");
  f.flush();
  expect(element(f.tree(), "apply").props.disabled).toBe(true);
  oldApply();
  f.flush();
  expect(f.workspace.financialScreen.getSnapshot()).toBe(before);
  expect(f.api.annualReport).not.toHaveBeenCalled();
});
it("keeps raw criteria independent and refuses preview while criteria are staged", async () => {
  const f = await fixture();
  f.choose();
  const screen = f.workspace.financialScreen;
  screen.stageCriteria(screen.getSnapshot());
  f.flush();
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  expect(f.html()("#managed-watchlist-screen-readiness").text()).toContain(
    "criteria",
  );
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
});

it("retains the mounted class choice across navigation while retiring the old preview", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  click(f.tree(), "apply");
  f.flush();
  const selected = f.workspace.financialScreen.getSnapshot().selected;
  click(f.tree(), "prepare");
  f.flush();
  const oldApply = element(f.tree(), "apply").props.onClick as () => void;
  f.workspace.setView("watchlist");
  f.flush();
  expect(element(f.tree(), "apply").props.disabled).toBe(true);
  f.workspace.setView("discover");
  f.flush();
  expect(f.html()("#managed-watchlist-screen-choice-0").val()).toBe(
    f.choice().listing.listingId,
  );
  expect(element(f.tree(), "apply").props.disabled).toBe(true);
  oldApply();
  f.flush();
  expect(f.workspace.financialScreen.getSnapshot().selected).toBe(selected);
  click(f.tree(), "prepare");
  f.flush();
  expect(
    f.html()("#managed-watchlist-screen-preview").parent().text(),
  ).toContain("identical ordered selection");
  click(f.tree(), "apply");
  f.flush();
  expect(f.workspace.financialScreen.getSnapshot().selected).toBe(selected);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
});
