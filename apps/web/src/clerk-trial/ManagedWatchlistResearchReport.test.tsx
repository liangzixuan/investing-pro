import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedWatchlistResearchReport } from "./ManagedWatchlistResearchReport";
import { WatchlistResearchReportSnapshot } from "./WatchlistResearchReportSnapshot";
import * as reportHtml from "./watchlist-research-report-html";
import { createWatchlistResearchPairFixture } from "./test-watchlist-research-pair-fixture";
import type { WatchlistResearchReportDeliveryAdapter } from "./watchlist-research-report-ports";
import type { TextDocumentDeliveryResult } from "./document-delivery";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  const direct = createValuationDraftTestHooks(hooks);
  return {
    ...actual,
    useRef: (value: unknown) =>
      hooks.direct ? direct.useRef(value) : actual.useRef(value),
    useState: (value: unknown) =>
      hooks.direct ? direct.useState(value) : actual.useState(value),
    useLayoutEffect: (effect: () => void, deps?: React.DependencyList) =>
      hooks.direct
        ? direct.useLayoutEffect(effect, deps)
        : actual.useLayoutEffect(effect, deps),
    useSyncExternalStore: (
      subscribe: () => () => void,
      snapshot: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? snapshot()
        : actual.useSyncExternalStore(subscribe, snapshot, server),
  };
});
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
function unmount() {
  for (const slot of hooks.slots) {
    if (
      slot &&
      typeof slot === "object" &&
      "cleanup" in slot &&
      typeof slot.cleanup === "function"
    )
      (slot as ValuationTestEffectSlot).cleanup?.();
  }
  hooks.effects = [];
}
afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

type Props = React.ComponentProps<typeof ManagedWatchlistResearchReport>;
type ElementProps = {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  role?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ref?: React.RefObject<HTMLHeadingElement | null>;
};
function nodes(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
function find(tree: React.ReactNode, suffix: string) {
  return nodes(tree).find(
    (node) => node.props.id === `managed-watchlist-research-report-${suffix}`,
  );
}
function button(tree: React.ReactNode, suffix: string) {
  const found = find(tree, suffix);
  if (!found) throw new Error(`Missing report button ${suffix}`);
  return found;
}
function status(tree: React.ReactNode) {
  return nodes(tree).find((node) => node.props.role === "status")?.props
    .children;
}
function snapshot(tree: React.ReactNode) {
  return nodes(tree).find(
    (node) => node.type === WatchlistResearchReportSnapshot,
  ) as
    | React.ReactElement<
        React.ComponentProps<typeof WatchlistResearchReportSnapshot>
      >
    | undefined;
}
function focusContext() {
  const document = { activeElement: null as unknown };
  const opener = { ownerDocument: document };
  document.activeElement = opener;
  const target = {
    ownerDocument: document,
    isConnected: true,
    closest: vi.fn((): object | null => null),
    getClientRects: vi.fn(() => [{}]),
    focus: vi.fn(),
  };
  return { document, opener: opener as unknown as HTMLButtonElement, target };
}
function render(props: Props) {
  hooks.direct = true;
  hooks.index = 0;
  return ManagedWatchlistResearchReport(props);
}
function commit(
  tree: React.ReactNode,
  target?: ReturnType<typeof focusContext>["target"],
) {
  const ref = find(tree, "heading")?.props.ref;
  if (ref && target) ref.current = target as unknown as HTMLHeadingElement;
  const effects = hooks.effects.splice(0);
  effects.forEach((effect) => effect());
}
function click(
  tree: React.ReactNode,
  suffix: string,
  opener = focusContext().opener,
) {
  button(tree, suffix).props.onClick?.({
    currentTarget: opener,
  } as React.MouseEvent<HTMLButtonElement>);
}
function mounted(props: Props) {
  commit(render(props));
  const tree = render(props);
  commit(tree);
  return tree;
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
async function fixture() {
  const f = await createWatchlistResearchPairFixture();
  f.choose(1);
  for (const side of ["left", "right"] as const) {
    const visit = f.open(side);
    f.valuation.calculate();
    f.model.reconcile();
    expect(f.model.capture(f.model.getSnapshot(), visit)).not.toBeNull();
    f.back();
  }
  const deliver = vi
    .fn<WatchlistResearchReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  // Direct hooks have no DOM. Keep the real complete snapshot and substitute
  // only the detached-document transport formatter for these lifecycle tests.
  vi.spyOn(reportHtml, "formatWatchlistResearchReportHtml").mockImplementation(
    (report) => {
      hooks.direct = false;
      const text = renderToStaticMarkup(
        <WatchlistResearchReportSnapshot report={report} />,
      );
      return {
        purpose: "investment.watchlist-research-html",
        filename: "fixture.html",
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
      };
    },
  );
  const props: Props = {
    model: f.model,
    delivery: { deliver, actionLabel: "Keep complete HTML" },
    routeActive: () => true,
  };
  return { ...f, deliver, props };
}
function pending(f: Awaited<ReturnType<typeof fixture>>) {
  let finish!: (result: TextDocumentDeliveryResult) => void;
  f.deliver.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  return (result: TextDocumentDeliveryResult) => finish(result);
}

it("prepares explicitly and previews and saves both complete readings without source effects", async () => {
  const f = await fixture();
  let tree = mounted(f.props);
  expect(snapshot(tree)).toBeUndefined();
  expect(f.deliver).not.toHaveBeenCalled();
  click(tree, "prepare");
  tree = render(f.props);
  commit(tree);
  const report = snapshot(tree)!.props.report;
  hooks.direct = false;
  const preview = load(
    renderToStaticMarkup(<WatchlistResearchReportSnapshot report={report} />),
  );
  expect(
    JSON.parse(preview("[data-watchlist-research-payload]").text()),
  ).toEqual(report);
  expect(button(tree, "save").props.children).toBe("Keep complete HTML");
  click(tree, "save");
  await settle();
  tree = render(f.props);
  const document = f.deliver.mock.calls[0]![0];
  expect(
    JSON.parse(load(document.text)("[data-watchlist-research-payload]").text()),
  ).toEqual(report);
  expect(status(tree)).toContain("written");
  expect(f.annualRead).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
  expect(snapshot(tree)!.props.report).toBe(report);
});

it("cancels a pending save, retains its preview, and clears it without late success", async () => {
  const f = await fixture();
  const finish = pending(f);
  click(mounted(f.props), "prepare");
  let tree = render(f.props);
  const report = snapshot(tree)!.props.report;
  click(tree, "save");
  tree = render(f.props);
  expect(button(tree, "save").props.disabled).toBe(true);
  expect(button(tree, "prepare").props.disabled).toBe(true);
  click(tree, "cancel");
  const context = f.deliver.mock.calls[0]![1];
  expect(context.signal.aborted).toBe(true);
  tree = render(f.props);
  expect(snapshot(tree)!.props.report).toBe(report);
  expect(status(tree)).toContain("cancelled");
  click(tree, "clear");
  finish("written");
  await settle();
  tree = render(f.props);
  expect(snapshot(tree)).toBeUndefined();
  expect(status(tree)).toBe("");
});

it("keeps a prepared capture when only the route callback identity changes", async () => {
  const f = await fixture();
  click(mounted(f.props), "prepare");
  let tree = render(f.props);
  commit(tree);
  const report = snapshot(tree)!.props.report;
  const props = { ...f.props, routeActive: () => true };
  tree = render(props);
  commit(tree);
  tree = render(props);
  expect(snapshot(tree)!.props.report).toBe(report);
  click(tree, "save");
  await settle();
  expect(status(render(props))).toContain("written");
});

it("retires a pending report across route false/true and refuses its late success", async () => {
  const f = await fixture();
  const finish = pending(f);
  click(mounted(f.props), "prepare");
  click(render(f.props), "save");
  const context = f.deliver.mock.calls[0]![1];
  const inactive = { ...f.props, routeActive: () => false };
  const tree = render(inactive);
  expect(button(tree, "prepare").props.disabled).toBe(true);
  commit(tree);
  commit(render({ ...f.props, routeActive: () => true }));
  expect(context.isCurrent()).toBe(false);
  expect(context.signal.aborted).toBe(true);
  finish("written");
  await settle();
  expect(snapshot(render(f.props))).toBeUndefined();
  expect(status(render(f.props))).not.toContain("written");
});

for (const replacement of ["delivery", "model", "unmount"] as const) {
  it(`disposes a pending controller on ${replacement} without retaining its preview or success`, async () => {
    const f = await fixture();
    const finish = pending(f);
    click(mounted(f.props), "prepare");
    click(render(f.props), "save");
    const context = f.deliver.mock.calls[0]![1];
    let next = f.props;
    if (replacement === "delivery")
      next = {
        ...next,
        delivery: { deliver: vi.fn().mockResolvedValue("written") },
      };
    if (replacement === "model")
      next = { ...next, model: (await fixture()).model };
    if (replacement === "unmount") unmount();
    else commit(render(next));
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    finish("written");
    await settle();
    if (replacement !== "unmount") {
      const tree = render(next);
      expect(snapshot(tree)).toBeUndefined();
      expect(status(tree)).toBe("");
    }
  });
}

it("disables preparation for a missing reading or pending route, and refuses stale clicks", async () => {
  const f = await fixture();
  const previous = mounted(f.props);
  f.model.clearSide(f.model.getSnapshot(), "right");
  expect(button(render(f.props), "prepare").props.disabled).toBe(true);
  click(previous, "prepare");
  expect(snapshot(render(f.props))).toBeUndefined();
  expect(status(render(f.props))).toContain("could not be captured");
  expect(f.deliver).not.toHaveBeenCalled();
});

it("disables pending-route preparation and rejects an earlier enabled handler", async () => {
  const f = await fixture();
  const previous = mounted(f.props);
  const blocked = { ...f.props, routeActive: () => false };
  const tree = render(blocked);
  expect(button(tree, "prepare").props.disabled).toBe(true);
  commit(tree);
  click(previous, "prepare");
  expect(snapshot(render(blocked))).toBeUndefined();
  expect(f.deliver).not.toHaveBeenCalled();
});

for (const failure of ["format", "delivery"] as const) {
  it(`keeps the complete preview after ${failure} failure and allows a later explicit save`, async () => {
    const f = await fixture();
    click(mounted(f.props), "prepare");
    let tree = render(f.props);
    const report = snapshot(tree)!.props.report;
    if (failure === "format")
      vi.mocked(
        reportHtml.formatWatchlistResearchReportHtml,
      ).mockReturnValueOnce(null);
    else f.deliver.mockRejectedValueOnce(new Error("Synthetic write failure"));
    click(tree, "save");
    await settle();
    tree = render(f.props);
    expect(status(tree)).toContain("could not be saved");
    expect(snapshot(tree)!.props.report).toBe(report);
    expect(button(tree, "save").props.disabled).toBe(false);
    if (failure === "format") expect(f.deliver).not.toHaveBeenCalled();
    click(tree, "save");
    await settle();
    expect(status(render(f.props))).toContain("written");
  });
}

it("supports preview without a delivery adapter", async () => {
  const f = await fixture();
  const props = { ...f.props, delivery: undefined };
  click(mounted(props), "prepare");
  const tree = render(props);
  expect(snapshot(tree)).toBeDefined();
  expect(find(tree, "save")).toBeUndefined();
  click(tree, "clear");
  expect(snapshot(render(props))).toBeUndefined();
});

for (const change of [
  "none",
  "focus",
  "retired",
  "hidden",
  "detached",
] as const) {
  it(`focuses only a committed current report with its opener still focused (${change})`, async () => {
    const f = await fixture();
    const focus = focusContext();
    click(mounted(f.props), "prepare", focus.opener);
    if (change === "focus") focus.document.activeElement = {};
    if (change === "retired") f.note("Changed before commit");
    if (change === "hidden") focus.target.closest.mockReturnValue({});
    if (change === "detached") focus.target.isConnected = false;
    expect(focus.target.focus).not.toHaveBeenCalled();
    commit(render(f.props), focus.target);
    expect(focus.target.focus).toHaveBeenCalledTimes(change === "none" ? 1 : 0);
    commit(render(f.props), focus.target);
    expect(focus.target.focus).toHaveBeenCalledTimes(change === "none" ? 1 : 0);
  });
}
