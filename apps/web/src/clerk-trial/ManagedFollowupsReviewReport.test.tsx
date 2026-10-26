import type * as FollowupsHtml from "./followups-review-report-html";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedFollowupsReviewReport as Panel } from "./ManagedFollowupsReviewReport";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";

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
vi.mock("./followups-review-report-html", async (original) => ({
  ...(await original<typeof FollowupsHtml>()),
  // Real HTML/brand/content admission belongs to the formatter's domain tests.
  formatFollowupsReviewReportHtml: () => ({
    purpose: "investment.followups-review-html",
    filename: "transport-only.html",
    text: "transport-only",
    byteLength: 14,
  }),
}));
type Element = React.ReactElement<Record<string, unknown>>;
const disposals: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
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
  const f = await createFollowupsReviewFixture();
  disposals.push(f.dispose);
  let active = true;
  const routeActive = () => active;
  const deliver = vi
    .fn<FollowupsReviewReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const delivery = { deliver };
  const render = () => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effectIndex = 0;
    let node: React.ReactElement<React.ComponentProps<"details">>;
    try {
      node = Panel({ workspace: f.workspace, delivery, routeActive });
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
    const element = render().element(`managed-followups-report-${id}`);
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
it("starts closed without a source or file action and previews every exact entry before explicit HTML save", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.complete(
    m.currentEntry(f.entries[1]!.id)!,
    new Date("2026-10-25T00:00:00.000Z"),
  );
  m.setFilter("open");
  const before = m.coordinator.getSnapshot();
  const initial = f.render();
  expect(initial.node.type).toBe("details");
  expect(initial.node.props.open).toBeUndefined();
  expect(initial.has("managed-followups-report-preview")).toBe(false);
  expect(f.deliver).not.toHaveBeenCalled();
  expect(initial.html).toContain("Capture follow-ups report");
  f.click("capture");
  const captured = f.render();
  const json = captured.element("managed-followups-report-json");
  expect(json.type).toBe("textarea");
  expect(json.props.readOnly).toBe(true);
  const full: unknown = JSON.parse(json.props.value as string);
  expect(full).toMatchObject({
    draft: before.draft,
    baseVersion: before.baseVersion,
    dirty: true,
  });
  for (const entry of before.draft!.entries) {
    expect(captured.html).toContain(entry.id);
    expect(captured.html).toContain(entry.check);
    expect(captured.html).toContain(entry.listing.shareClassId);
    expect(captured.html).toContain(entry.catalogSnapshotSha256);
  }
  expect(captured.html).toContain("2026-10-25");
  expect(captured.html).toContain("Save report (HTML)");
  expect(captured.html).toContain("Close captured report");
  f.click("save");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(f.render().html).toContain(
    "Follow-ups report written to the chosen document.",
  );
  expect(m.coordinator.getSnapshot()).toBe(before);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  f.click("close");
  expect(f.render().has("managed-followups-report-json")).toBe(false);
  expect(m.coordinator.getSnapshot()).toBe(before);
});
it("exposes cancel while saving, fences late writes, and distinguishes browser download requests", async () => {
  const f = await fixture();
  const pending = deferred<"written">();
  f.deliver.mockReturnValueOnce(pending.promise);
  f.click("capture");
  f.click("save");
  expect(
    f.render().element("managed-followups-report-save").props.disabled,
  ).toBe(true);
  expect(
    f.render().element("managed-followups-report-capture").props.disabled,
  ).toBe(true);
  expect(f.render().html).toContain("Cancel report save");
  f.click("cancel");
  expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
  pending.resolve("written");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.render().html).toContain("Report save cancelled.");
  expect(f.render().has("managed-followups-report-json")).toBe(true);
  f.deliver.mockResolvedValueOnce("download_requested");
  f.click("save");
  await Promise.resolve();
  await Promise.resolve();
  expect(f.render().html).toContain(
    "download requested. Check the browser destination.",
  );
});
it("closing the disclosure, leaving the route and unmounting each abort and clear owned private content", async () => {
  const f = await fixture();
  for (const action of ["disclosure", "route", "unmount"] as const) {
    const pending = deferred<"written">();
    f.deliver.mockReturnValueOnce(pending.promise);
    f.click("capture");
    f.click("save");
    if (action === "disclosure")
      (f.render().node.props.onToggle as (event: unknown) => void)({
        currentTarget: { open: false },
      });
    if (action === "route") f.route(false);
    if (action === "unmount")
      hooks.cleanups
        .splice(0)
        .reverse()
        .forEach((cleanup) => cleanup());
    expect(f.deliver.mock.calls.at(-1)![1].signal.aborted).toBe(true);
    pending.resolve("written");
    await Promise.resolve();
    await Promise.resolve();
    expect(f.render().has("managed-followups-report-json")).toBe(false);
    if (action === "route") f.route(true);
  }
});
it("keeps malformed authored text for correction, reports refusal, and retires a capture on later editing", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.edit(
    m.currentEntry(f.entries[0]!.id)!,
    "check",
    "  retained raw question  ",
  );
  const before = m.coordinator.getSnapshot();
  f.click("capture");
  expect(f.render().has("managed-followups-report-json")).toBe(false);
  expect(f.render().html).toContain("current valid Follow-ups draft");
  expect(m.coordinator.getSnapshot()).toBe(before);
  m.edit(m.currentEntry(f.entries[0]!.id)!, "check", "Corrected question");
  f.click("capture");
  expect(f.render().has("managed-followups-report-json")).toBe(true);
  m.edit(m.currentEntry(f.entries[0]!.id)!, "result", "Changed assessment");
  expect(f.render().has("managed-followups-report-json")).toBe(false);
  expect(f.render().html).toContain("no longer current");
  expect(f.deliver).not.toHaveBeenCalled();
});
