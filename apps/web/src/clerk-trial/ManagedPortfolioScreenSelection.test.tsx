import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedPortfolioScreenSelection } from "./ManagedPortfolioScreenSelection";
import {
  portfolioScreenFixture,
  portfolioScreenLedger,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
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
const fixtures: Awaited<ReturnType<typeof portfolioScreenFixture>>[] = [];
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
    (item) => item.props.id === `managed-portfolio-screen-${suffix}`,
  )!;
}
function click(tree: React.ReactNode, suffix: string) {
  const target = element(tree, suffix);
  expect(target).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  doc.activeElement = nodes.get(`managed-portfolio-screen-${suffix}`)!;
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
async function fixture(loadPortfolio = true, loadCohort = true) {
  const f = await portfolioScreenFixture(loadPortfolio, loadCohort);
  fixtures.push(f);
  let tree: ReturnType<typeof ManagedPortfolioScreenSelection> = null;
  const route = () => true;
  function render(commit = true) {
    hooks.index = 0;
    hooks.effects = [];
    hooks.dirty = false;
    const next = ManagedPortfolioScreenSelection({
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

it("shows every full identity and exact holding, requires a share-class choice, then previews and applies separately from Run", async () => {
  const f = await fixture();
  const before = f.workspace.portfolio.coordinator.getSnapshot();
  expect(f.html()("#managed-portfolio-screen-choice-0").val()).toBe("");
  expect(
    f
      .html()("[data-holding-shares]")
      .map((_i, e) => f.html()(e).text())
      .get(),
  ).toEqual(["2.000001", "2.000001", "2.000001"]);
  expect(f.html()("dd").text()).toContain("listing-outside");
  expect(f.html()("#managed-portfolio-screen-saved-state").text()).toContain(
    "unsaved",
  );
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-preview")!.focus,
  ).toHaveBeenCalledOnce();
  expect(f.html()("#managed-portfolio-screen-selected li")).toHaveLength(1);
  expect(f.html()("#managed-portfolio-screen-selected").text()).toContain(
    "ZEROC",
  );
  click(f.tree(), "apply");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).toHaveBeenCalledOnce();
  expect(f.html()("#managed-portfolio-screen-message").text()).toContain(
    "Run screen separately",
  );
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(before);
  expect(f.api.annualReport).not.toHaveBeenCalled();
});

it("updates readiness on real Portfolio and cohort notifications and never focuses during loads or file activity", async () => {
  const f = await fixture(false, false);
  expect(f.html()("#managed-portfolio-screen-readiness").text()).toContain(
    "load",
  );
  let resolve!: (value: {
    version: number;
    payload: typeof portfolioScreenLedger;
  }) => void;
  f.api.loadPortfolio.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = f.workspace.portfolio.coordinator.load();
  f.flush();
  resolve({ version: 1, payload: portfolioScreenLedger });
  await pending;
  f.flush();
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  f.flush();
  expect(f.html()("#managed-portfolio-screen-readiness").text()).toContain(
    "cohort",
  );
  await f.workspace.financialScreen.loadUniverse(
    f.workspace.financialScreen.getSnapshot(),
  );
  f.flush();
  f.choose();
  expect(element(f.tree(), "prepare").props.disabled).toBe(false);
  const operation = {};
  f.workspace.portfolio.beginDraftFileActivity(operation);
  f.flush();
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  f.workspace.portfolio.endDraftFileActivity(operation);
  f.flush();
  expect(element(f.tree(), "prepare").props.disabled).toBe(false);
  for (const node of nodes.values()) expect(node.focus).not.toHaveBeenCalled();
});

it("retires choices and preview handlers on choice ABA and restores focus only for the owned Cancel", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  const old = f.tree();
  click(old, "cancel");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-prepare")!.focus,
  ).toHaveBeenCalledOnce();
  (element(old, "apply").props.onClick as () => void)();
  expect(f.workspace.financialScreen.getSnapshot().selected[0]).toBe(
    f.choice(false),
  );
  click(f.tree(), "prepare");
  f.flush();
  const preview = f.tree();
  f.choose("");
  f.choose();
  (element(preview, "apply").props.onClick as () => void)();
  expect(f.workspace.financialScreen.getSnapshot().selected[0]).toBe(
    f.choice(false),
  );
});

it("does not focus or publish success after reentrant navigation", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  const off = f.workspace.financialScreen.subscribe(() => {
    off();
    f.workspace.setView("portfolio");
  });
  click(f.tree(), "apply");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).not.toHaveBeenCalled();
  expect(f.html()("#managed-portfolio-screen-message").text()).not.toContain(
    "companies selected",
  );
});

it("does not publish success or focus a replacement screen during Apply", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  const off = f.workspace.financialScreen.subscribe(() => {
    off();
    f.workspace.financialScreen.select(
      f.workspace.financialScreen.getSnapshot(),
      f.choice(),
      false,
    );
  });
  click(f.tree(), "apply");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).not.toHaveBeenCalled();
  expect(f.html()("#managed-portfolio-screen-message").text()).not.toContain(
    "companies selected",
  );
});

it("rejects abandoned-render handlers and consumes the preview on unmount", async () => {
  const f = await fixture();
  f.choose();
  const abandoned = f.render(false);
  (element(abandoned, "prepare").props.onClick as () => void)();
  expect(f.html()("#managed-portfolio-screen-preview")).toHaveLength(0);
  f.render();
  click(f.tree(), "prepare");
  f.flush();
  const preview = f.tree();
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  (element(preview, "apply").props.onClick as () => void)();
  expect(f.workspace.financialScreen.getSnapshot().selected[0]).toBe(
    f.choice(false),
  );
});

it("does not publish success after Apply synchronously unmounts its component", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  const off = f.workspace.financialScreen.subscribe(() => {
    off();
    for (const slot of hooks.slots)
      (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  });
  click(f.tree(), "apply");
  const stored = hooks.slots.filter(
    (value): value is { message: unknown } =>
      typeof value === "object" && value !== null && "message" in value,
  );
  expect(
    stored.every(
      (value) =>
        typeof value.message !== "string" ||
        !value.message.includes("companies selected"),
    ),
  ).toBe(true);
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).not.toHaveBeenCalled();
});

it("does not steal focus between preparation and commit or restore Cancel focus after a navigation ABA", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  const other = { focus: vi.fn(), isConnected: true };
  doc.activeElement = other;
  f.flush();
  expect(doc.activeElement).toBe(other);
  expect(
    nodes.get("managed-portfolio-screen-preview")!.focus,
  ).not.toHaveBeenCalled();
  click(f.tree(), "cancel");
  f.workspace.setView("discover");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-prepare")!.focus,
  ).not.toHaveBeenCalled();
});

it("recovers explicitly when a held share class disappears and no choice group remains", async () => {
  const f = await fixture();
  f.choose();
  click(f.tree(), "prepare");
  f.flush();
  const oldPreview = f.tree();
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  f.workspace.portfolio.replace(draft, {
    ...draft.ledger!,
    opening: {
      ...draft.ledger!.opening,
      holdings: draft.ledger!.opening.holdings.filter(
        (holding) => holding.listingId !== f.choice().listing.listingId,
      ),
    },
  });
  f.flush();
  expect(f.html()("#managed-portfolio-screen-choice-0")).toHaveLength(0);
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  const saved = f.workspace.portfolio.coordinator.getSnapshot();
  const screen = f.workspace.financialScreen.getSnapshot();
  click(f.tree(), "reset-choices");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).toHaveBeenCalledOnce();
  expect(element(f.tree(), "prepare").props.disabled).toBe(false);
  expect(f.html()("#managed-portfolio-screen-preview")).toHaveLength(0);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  expect(f.workspace.financialScreen.getSnapshot()).toBe(screen);
  (element(oldPreview, "apply").props.onClick as () => void)();
  expect(f.workspace.financialScreen.getSnapshot()).toBe(screen);
  expect(f.api.annualReport).not.toHaveBeenCalled();
});

it("fences old Reset handlers and does not focus after a reset loses its visit", async () => {
  const f = await fixture();
  f.choose();
  const old = f.tree();
  f.choose(f.choice(false).listing.listingId);
  (element(old, "reset-choices").props.onClick as () => void)();
  f.flush();
  expect(f.html()("#managed-portfolio-screen-choice-0").val()).toBe(
    f.choice(false).listing.listingId,
  );
  click(f.tree(), "reset-choices");
  f.workspace.setView("discover");
  f.flush();
  expect(
    nodes.get("managed-portfolio-screen-heading")!.focus,
  ).not.toHaveBeenCalled();
  expect(f.html()("#managed-portfolio-screen-choice-0").val()).toBe("");
});

it("resets a stale cohort member without selecting its replacement share class", async () => {
  const f = await fixture();
  f.choose();
  const oldMember = f.choice();
  f.api.status.mockResolvedValueOnce({
    snapshot: {
      ...portfolioScreenCatalog,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    },
  });
  await f.workspace.refreshCatalog();
  f.api.status.mockResolvedValueOnce({ snapshot: portfolioScreenCatalog });
  await f.workspace.refreshCatalog();
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  await f.workspace.financialScreen.loadUniverse(
    f.workspace.financialScreen.getSnapshot(),
  );
  f.flush();
  expect(f.choice()).not.toBe(oldMember);
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  const screen = f.workspace.financialScreen.getSnapshot();
  const saved = f.workspace.portfolio.coordinator.getSnapshot();
  click(f.tree(), "reset-choices");
  f.flush();
  expect(f.html()("#managed-portfolio-screen-choice-0").val()).toBe("");
  expect(element(f.tree(), "prepare").props.disabled).toBe(true);
  expect(f.workspace.financialScreen.getSnapshot()).toBe(screen);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(saved);
  f.choose();
  expect(element(f.tree(), "prepare").props.disabled).toBe(false);
  expect(f.api.annualReport).not.toHaveBeenCalled();
});
