import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedPortfolioHeldDueChecks } from "./ManagedPortfolioHeldDueChecks";
import { heldDueFixture } from "./test-portfolio-held-due-fixture";
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
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(hooks),
    useSyncExternalStore(
      subscribe: (l: () => void) => () => void,
      snapshot: () => unknown,
    ) {
      if (!hooks.subscriptions.has(subscribe))
        hooks.subscriptions.set(
          subscribe,
          subscribe(() => {
            hooks.dirty = true;
          }),
        );
      return snapshot();
    },
  };
});
type Element = React.ReactElement<Record<string, unknown>>;
type Node = {
  focus: ReturnType<typeof vi.fn>;
  isConnected: boolean;
  closest: () => { open: boolean };
};
const disclosure = { open: false };
const nodes = new Map<string, Node>();
const doc: {
  activeElement: Node | null;
  body: Node;
  getElementById: (id: string) => Node | null;
} = {
  activeElement: null,
  body: { focus: vi.fn(), isConnected: true, closest: () => disclosure },
  getElementById: (id) => nodes.get(id) ?? null,
};
const fixtures: Awaited<ReturnType<typeof heldDueFixture>>[] = [];
function elements(value: React.ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as React.ReactNode)];
}
function node(id: string) {
  let n = nodes.get(id);
  if (!n) {
    n = { focus: vi.fn(), isConnected: true, closest: () => disclosure };
    n.focus.mockImplementation(() => {
      doc.activeElement = n!;
    });
    nodes.set(id, n);
  }
  return n;
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  hooks.dirty = false;
  nodes.clear();
  disclosure.open = false;
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function fixture(p = true, f = true) {
  const result = await heldDueFixture(p, f);
  fixtures.push(result);
  let tree: React.ReactNode;
  let active = true;
  function render() {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    tree = ManagedPortfolioHeldDueChecks({
      workspace: result.workspace,
      active,
      routeActive: () => active,
    });
    const present = new Set<string>();
    for (const e of elements(tree)) {
      if (typeof e.props.id === "string") {
        present.add(e.props.id);
        node(e.props.id).isConnected = true;
      }
    }
    for (const [id, n] of nodes) {
      if (!present.has(id) && id !== "managed-followups-review-heading") {
        n.isConnected = false;
        if (doc.activeElement === n) doc.activeElement = doc.body;
      }
    }
    hooks.effects.splice(0).forEach((effect) => effect());
    return tree;
  }
  function get(suffix: string) {
    return elements(tree).find(
      (e) => e.props.id === `portfolio-held-due-${suffix}`,
    )!;
  }
  function click(suffix: string, commit = true) {
    const e = get(suffix);
    expect(e).toBeDefined();
    expect(e.props.disabled).not.toBe(true);
    const button = node(String(e.props.id));
    doc.activeElement = button;
    (e.props.onClick as (event: { currentTarget: Node }) => void)({
      currentTarget: button,
    });
    if (commit && hooks.dirty) render();
  }
  node("managed-followups-review-heading");
  render();
  return {
    ...result,
    render,
    get,
    click,
    html: () => load(renderToStaticMarkup(tree)),
    setActive: (value: boolean) => {
      active = value;
    },
    flush: () => {
      if (hooks.dirty) render();
    },
  };
}
it("renders complete exact identities, raw questions/results, holdings and exclusion reasons with unique IDs and escaped text", async () => {
  const f = await fixture(),
    $ = f.html();
  expect($("[data-held-due-listing]")).toHaveLength(3);
  expect($(".managed-followups-review-choices > li")).toHaveLength(0);
  expect($("[data-held-due-check]")).toHaveLength(3);
  expect($("[data-eligible=false]").text()).toContain("due later");
  for (const e of f.stored().payload.entries) {
    expect($.text()).toContain(e.check);
    expect($.text()).toContain(e.result);
    expect($.text()).toContain(e.listing.listingId);
    expect($.text()).toContain(e.catalogSnapshotSha256);
  }
  expect($("script")).toHaveLength(0);
  expect($.text()).toContain("2.000001");
  expect($.text()).toContain("2026-10-01");
  const ids = $("[id]")
    .map((_i, e) => $(e).attr("id"))
    .get();
  expect(new Set(ids).size).toBe(ids.length);
  expect(f.get("start")).toBeUndefined();
});
it("explicit loads notify the rendered intake and never move focus or prepare automatically", async () => {
  const f = await fixture(false, false);
  const initial = node("portfolio-held-due-heading");
  doc.activeElement = initial;
  await f.intake.loadPortfolio(f.intake.getSnapshot());
  f.flush();
  expect(f.get("prepare").props.disabled).toBe(true);
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  await f.intake.loadFollowups(f.intake.getSnapshot());
  expect(hooks.dirty).toBe(true);
  f.flush();
  expect(f.get("prepare").props.disabled).toBe(false);
  expect(doc.activeElement).toBe(initial);
  expect(f.intake.getSnapshot().prepared).toBe(false);
  expect(disclosure.open).toBe(false);
});
function choose(f: Awaited<ReturnType<typeof fixture>>) {
  f.click("prepare");
  const entries = f.intake.getSnapshot().plan.eligible;
  f.click(`choose-${entries[1]!.id}`);
  f.click(`choose-${entries[0]!.id}`);
}
it("focuses the committed preview then exact existing review after one Start with ordered classes", async () => {
  const f = await fixture();
  f.click("prepare");
  expect(doc.activeElement).toBe(node("portfolio-held-due-preview"));
  const entries = f.intake.getSnapshot().plan.eligible;
  f.click(`choose-${entries[1]!.id}`);
  f.click(`choose-${entries[0]!.id}`);
  disclosure.open = false;
  f.click("start");
  expect(disclosure.open).toBe(true);
  expect(doc.activeElement).toBe(node("managed-followups-review-heading"));
  expect(f.review.getSnapshot().chosen.map((r) => r.entry.id)).toEqual([
    entries[1]!.id,
    entries[0]!.id,
  ]);
});
it("does not disclose or focus after a reentrant Portfolio change during Start", async () => {
  const f = await fixture();
  choose(f);
  disclosure.open = false;
  const off = f.review.subscribe(() => {
    if (f.review.getSnapshot().phase === "reviewing")
      f.workspace.portfolio.setPendingEditor(
        f.workspace.portfolio.coordinator.getSnapshot().draft!,
        true,
      );
  });
  f.click("start");
  off();
  expect(f.review.getSnapshot().entered).toBe(false);
  expect(disclosure.open).toBe(false);
  expect(node("managed-followups-review-heading").focus).not.toHaveBeenCalled();
});
it("cancels pending focus after route ABA or a user focus move", async () => {
  const f = await fixture();
  f.click("prepare", false);
  f.workspace.setView("followups");
  f.render();
  expect(node("portfolio-held-due-preview").focus).not.toHaveBeenCalled();
  f.click("prepare", false);
  const other = node("portfolio-held-due-heading");
  doc.activeElement = other;
  f.render();
  expect(node("portfolio-held-due-preview").focus).not.toHaveBeenCalled();
});
it("rejects a stale rendered handler and a handler retained after unmount", async () => {
  const f = await fixture();
  const old = f.get("prepare").props.onClick as (e: {
    currentTarget: Node;
  }) => void;
  f.workspace.setView("followups");
  old({ currentTarget: node("portfolio-held-due-prepare") });
  expect(f.intake.getSnapshot().prepared).toBe(false);
  f.render();
  const unmounted = f.get("prepare").props.onClick as typeof old;
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  unmounted({ currentTarget: node("portfolio-held-due-prepare") });
  expect(f.intake.getSnapshot().prepared).toBe(false);
});
it("Cancel clears only selection and returns focus to its current prepare action", async () => {
  const f = await fixture(),
    draft = f.workspace.followups.coordinator.getSnapshot().draft;
  choose(f);
  f.click("cancel");
  expect(doc.activeElement).toBe(node("portfolio-held-due-prepare"));
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.review.getSnapshot().entered).toBe(false);
});
