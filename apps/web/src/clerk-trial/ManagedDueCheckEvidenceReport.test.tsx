import type * as DueHtml from "./due-check-evidence-report-html";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedDueCheckEvidenceReport as Panel } from "./ManagedDueCheckEvidenceReport";
import { finishedDueCheckReportFixture } from "./test-due-check-evidence-report-fixture";
import type { DueCheckEvidenceReportDeliveryAdapter } from "./due-check-evidence-report-ports";

// Controlled hook commits use actual controller/source and component callbacks.
// This is not mounted-browser layout or physical keyboard acceptance.
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  effectIndex: 0,
  slots: [] as unknown[],
  dependencies: [] as Array<React.DependencyList | undefined>,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));
function controlledRef(initial: unknown) {
  return (hooks.slots[hooks.index++] ??= { current: initial });
}
function controlledState(initial: unknown) {
  const slot = hooks.index++;
  if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
  return [
    hooks.slots[slot],
    (value: unknown) => {
      hooks.slots[slot] = value;
    },
  ];
}
function sameDependencies(
  before: React.DependencyList | undefined,
  next: React.DependencyList | undefined,
) {
  if (!next) return false;
  if (!before) return false;
  if (next.length !== before.length) return false;
  return next.every((value, at) => value === before[at]);
}
function controlledEffect(
  effect: () => void | (() => void),
  dependencies?: React.DependencyList,
) {
  const index = hooks.effectIndex++;
  if (sameDependencies(hooks.dependencies[index], dependencies)) return;
  hooks.dependencies[index] = dependencies;
  hooks.effects.push(effect);
}
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (initial: unknown) =>
      hooks.direct ? controlledRef(initial) : actual.useRef(initial),
    useState: (initial: unknown) =>
      hooks.direct ? controlledState(initial) : actual.useState(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      dependencies?: React.DependencyList,
    ) =>
      hooks.direct
        ? controlledEffect(effect, dependencies)
        : actual.useLayoutEffect(effect, dependencies),
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      get: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? get()
        : actual.useSyncExternalStore(subscribe, get, server),
  };
});
vi.mock("./due-check-evidence-report-html", async (original) => ({
  ...(await original<typeof DueHtml>()),
  // Real HTML/brand/content admission belongs to the formatter's domain tests.
  formatDueCheckEvidenceReportHtml: () => ({
    purpose: "investment.due-check-evidence-html",
    filename: "transport-only.html",
    text: "transport-only",
    byteLength: 14,
  }),
}));
type Element = React.ReactElement<Record<string, unknown>>;
const disposals: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
});
afterEach(() => {
  hooks.cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
  hooks.slots = [];
  hooks.dependencies = [];
  hooks.effects = [];
  hooks.direct = false;
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function find(node: React.ReactNode, id: string): Element | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, unknown>>(child)) continue;
    if (child.props.id === id) return child;
    const nested = find(child.props.children as React.ReactNode, id);
    if (nested) return nested;
  }
}
async function fixture() {
  const f = await finishedDueCheckReportFixture();
  disposals.push(f.dispose);
  let active = true;
  const routeActive = () => active;
  const deliver = vi
    .fn<DueCheckEvidenceReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const delivery = { deliver };
  const render = () => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effectIndex = 0;
    let node: React.ReactNode;
    try {
      node = Panel({ workspace: f.workspace, active, delivery, routeActive });
    } finally {
      hooks.direct = false;
    }
    return {
      node,
      html: renderToStaticMarkup(node),
      element: (id: string) => {
        const value = find(node, id);
        if (!value) throw new Error(`Missing report control ${id}`);
        return value;
      },
      has: (id: string) => !!find(node, id),
    };
  };
  const commit = () => {
    for (const effect of hooks.effects.splice(0)) {
      const cleanup = effect();
      if (cleanup) hooks.cleanups.push(cleanup);
    }
  };
  const click = (id: string) => {
    const element = render().element(`managed-due-check-report-${id}`);
    commit();
    expect(element.props.disabled).not.toBe(true);
    return (element.props.onClick as () => void)();
  };
  render();
  commit();
  render();
  commit();
  return {
    ...f,
    deliver,
    render,
    commit,
    click,
    route: (value: boolean) => {
      active = value;
      render();
      commit();
    },
  };
}
it("prepares only on an explicit action, exposes the complete passive preview, and saves independently", async () => {
  const f = await fixture();
  const before = f.workspace.followups.coordinator.getSnapshot();
  const requests = [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
  ].map((fn) => vi.mocked(fn).mock.calls.length);
  expect(f.render().has("managed-due-check-report-preview")).toBe(false);
  expect(f.deliver).not.toHaveBeenCalled();
  f.click("prepare");
  const page = f.render();
  expect(page.has("managed-due-check-report-preview")).toBe(true);
  expect(page.html).toContain(
    "No source reading was retained for this chosen check.",
  );
  expect(page.html).toContain("Final authored assessment");
  expect(page.html).not.toContain("<script>");
  const focus = vi.fn();
  (
    page.element("managed-due-check-report-heading").props
      .ref as React.RefObject<unknown>
  ).current = { focus };
  f.commit();
  expect(focus).toHaveBeenCalledOnce();
  f.click("save");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(f.render().html).toContain("written to the chosen document");
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(
    [f.api.eodHistory, f.api.annualReport, f.api.recentFilings].map(
      (fn) => vi.mocked(fn).mock.calls.length,
    ),
  ).toEqual(requests);
  f.click("close");
  expect(f.render().has("managed-due-check-report-preview")).toBe(false);
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
});
it("cancel keeps the prepared reading and ignores the late native completion", async () => {
  const f = await fixture(),
    pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  f.click("prepare");
  f.click("save");
  expect(
    f.render().element("managed-due-check-report-prepare").props.disabled,
  ).toBe(true);
  f.click("cancel");
  expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
  pending.resolve("written");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.render().html).toContain("report save cancelled");
  expect(f.render().has("managed-due-check-report-preview")).toBe(true);
});
it("route retirement aborts an in-flight save and stale handlers cannot revive its report or focus", async () => {
  const f = await fixture(),
    pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  const stalePrepare = f.render().element("managed-due-check-report-prepare")
    .props.onClick as () => void;
  f.click("prepare");
  f.click("save");
  f.route(false);
  stalePrepare();
  expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
  expect(f.render().has("managed-due-check-report-preview")).toBe(false);
  pending.resolve("written");
  await Promise.resolve();
  await Promise.resolve();
  f.route(true);
  expect(f.render().has("managed-due-check-report-preview")).toBe(false);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
