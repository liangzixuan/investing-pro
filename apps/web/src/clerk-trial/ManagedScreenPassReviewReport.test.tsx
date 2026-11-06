import type * as DueHtml from "./screen-pass-review-report-html";
import * as React from "react";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedScreenPassReviewReport as Panel } from "./ManagedScreenPassReviewReport";
import { screenPassReportFixture } from "./test-screen-pass-review-report-fixture";
import { ScreenPassReviewReportController } from "./screen-pass-review-report-controller";
import type { ScreenPassReviewReportDeliveryAdapter } from "./screen-pass-review-report-ports";

// Controlled hook commits use actual controller/source and component callbacks.
// This is not mounted-browser layout or physical keyboard acceptance.
const hooks = vi.hoisted(() => ({
  direct: false,
  openDisclosures: false,
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
      hooks.direct
        ? controlledState(initial)
        : actual.useState(
            hooks.openDisclosures && initial === false ? true : initial,
          ),
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
vi.mock("./screen-pass-review-report-html", async (original) => ({
  ...(await original<typeof DueHtml>()),
  // Real HTML/brand/content admission belongs to the formatter's domain tests.
  formatScreenPassReviewReportHtml: () => ({
    purpose: "investment.screen-pass-review-html",
    filename: "transport-only.html",
    text: "transport-only",
    byteLength: 14,
  }),
}));
type Element = React.ReactElement<Record<string, unknown>>;
const disposals: (() => void)[] = [];
beforeEach(() => {
  vi.stubGlobal("document", { activeElement: null, body: {} });
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
  hooks.openDisclosures = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
  const f = await screenPassReportFixture();
  disposals.push(() => f.dispose());
  let active = true;
  const routeActive = () => active;
  const deliver = vi
    .fn<ScreenPassReviewReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const delivery = { deliver };
  const render = (replacement: Partial<Parameters<typeof Panel>[0]> = {}) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effectIndex = 0;
    let node: React.ReactNode;
    try {
      node = Panel({
        workspace: f.w,
        pass: f.owner.controller,
        active,
        delivery,
        routeActive,
        ...replacement,
      });
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
    const element = render().element(`managed-screen-pass-report-${id}`);
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

it("prepares the complete comparison with committed focus and saves without resource effects", async () => {
  const f = await fixture();
  const before = f.w.coordinator.getSnapshot(),
    counts = f.meta.getSnapshot();
  f.click("prepare");
  const page = f.render();
  const focus = vi.fn();
  (
    page.element("managed-screen-pass-report-heading").props
      .ref as React.RefObject<unknown>
  ).current = { focus };
  f.commit();
  expect(focus).toHaveBeenCalledOnce();
  expect(page.html).toContain("Annual-pass comparison");
  expect(page.html).toContain("AAPL");
  expect(page.html).toContain("GOOGL");
  f.click("save");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(f.w.coordinator.getSnapshot()).toBe(before);
  expect(f.meta.getSnapshot()).toBe(counts);
  f.click("close");
  expect(f.render().has("managed-screen-pass-report-preview")).toBe(false);
});
it("retains the prepared report after Cancel and ignores late delivery", async () => {
  const f = await fixture(),
    pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  f.click("prepare");
  f.click("save");
  f.click("cancel");
  expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
  pending.resolve("written");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.render().html).toContain("save cancelled");
  expect(f.render().has("managed-screen-pass-report-preview")).toBe(true);
});
it("does not steal focus moved before the committed preparation effect and refuses stale render handlers", async () => {
  const f = await fixture();
  const stale = f.render().element("managed-screen-pass-report-prepare").props
    .onClick as () => void;
  f.click("prepare");
  const page = f.render();
  const focus = vi.fn();
  (
    page.element("managed-screen-pass-report-heading").props
      .ref as React.RefObject<unknown>
  ).current = { focus };
  (document as unknown as { activeElement: unknown }).activeElement = {
    isConnected: true,
  };
  f.commit();
  expect(focus).not.toHaveBeenCalled();
  f.click("close");
  f.render();
  f.commit();
  stale();
  expect(f.render().has("managed-screen-pass-report-preview")).toBe(false);
  f.click("prepare");
  const pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  f.click("save");
  f.route(false);
  expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
  pending.resolve("written");
  await Promise.resolve();
  await Promise.resolve();
  f.route(true);
  expect(f.render().has("managed-screen-pass-report-preview")).toBe(false);
});
it("keeps the complete opened payload passive with scoped wrapping", async () => {
  const f = await fixture();
  f.click("prepare");
  hooks.openDisclosures = true;
  const $ = load(f.render().html),
    panel = $(".managed-screen-pass-report");
  expect(panel).toHaveLength(1);
  expect(
    (
      JSON.parse(panel.find("pre[data-screen-pass-report-payload]").text()) as {
        current: unknown;
      }
    ).current,
  ).toEqual(
    JSON.parse(JSON.stringify(f.owner.controller.getSnapshot().result)),
  );
  expect(
    panel.find("article button,article input,article select,article textarea"),
  ).toHaveLength(0);
  const css = readFileSync(
    new URL("./managed-screen-pass-review-report.css", import.meta.url),
    "utf8",
  );
  expect(css).toContain("overflow-wrap: anywhere");
  expect(css).toContain("min-height: 44px");
});

it("refuses a replacement-props click before its owner has committed", async () => {
  const f = await fixture();
  f.click("prepare");
  const next = { deliver: vi.fn().mockResolvedValue("written") };
  const replacement = f.render({ delivery: next });
  (
    replacement.element("managed-screen-pass-report-save").props
      .onClick as () => void
  )();
  expect(f.deliver).not.toHaveBeenCalled();
  expect(next.deliver).not.toHaveBeenCalled();
  f.commit();
});

it("preserves editor focus moved by a synchronous preparation subscriber", async () => {
  const f = await fixture();
  const owner = hooks.slots.find(
    (value): value is { controller: ScreenPassReviewReportController } =>
      typeof value === "object" &&
      value !== null &&
      "controller" in value &&
      value.controller instanceof ScreenPassReviewReportController,
  )!;
  const editor = { isConnected: true };
  const stop = owner.controller.subscribe(() => {
    if (owner.controller.getSnapshot().report)
      (document as unknown as { activeElement: unknown }).activeElement =
        editor;
  });
  f.click("prepare");
  const page = f.render(),
    focus = vi.fn();
  (
    page.element("managed-screen-pass-report-heading").props
      .ref as React.RefObject<unknown>
  ).current = { focus };
  f.commit();
  expect(document.activeElement).toBe(editor);
  expect(focus).not.toHaveBeenCalled();
  stop();
});
