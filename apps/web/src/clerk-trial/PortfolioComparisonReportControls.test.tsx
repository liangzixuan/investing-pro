import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioComparisonReportView } from "./PortfolioComparisonReportControls";
import { PortfolioComparisonReportController } from "./portfolio-comparison-report-controller";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import {
  archiveBytes,
  archiveHtmlFixture,
  archiveReportFixture,
} from "./portfolio-report-archive-fixture";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  ...(
    await import("./valuation-draft-files-test-hooks")
  ).createValuationDraftTestHooks(hooks),
}));
type Element = React.ReactElement<Record<string, unknown>>;
type Node = { focus: ReturnType<typeof vi.fn>; isConnected: boolean };
const nodes = new Map<string, Node>();
const focusListeners = new Set<(event: { target: unknown }) => void>();
const doc: {
  activeElement: Node | null;
  body: Node;
  addEventListener: (
    type: string,
    listener: (event: { target: unknown }) => void,
  ) => unknown;
  removeEventListener: (
    type: string,
    listener: (event: { target: unknown }) => void,
  ) => unknown;
} = {
  activeElement: null,
  body: { focus: vi.fn(), isConnected: true },
  addEventListener: vi.fn(
    (_type: string, listener: (event: { target: unknown }) => void) =>
      focusListeners.add(listener),
  ),
  removeEventListener: vi.fn(
    (_type: string, listener: (event: { target: unknown }) => void) =>
      focusListeners.delete(listener),
  ),
};
function elements(value: React.ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as React.ReactNode)];
}
function focus(node: Node) {
  doc.activeElement = node;
  for (const listener of focusListeners) listener({ target: node });
}
function attach(tree: React.ReactNode) {
  for (const item of elements(tree)) {
    if (typeof item.props.id !== "string") continue;
    let node = nodes.get(item.props.id);
    if (!node) {
      node = { focus: vi.fn(), isConnected: true };
      node.focus.mockImplementation(() => focus(node!));
      nodes.set(item.props.id, node);
    }
    const ref = item.props.ref as { current: Node | null } | undefined;
    if (ref) ref.current = node;
  }
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  nodes.clear();
  focusListeners.clear();
  doc.activeElement = doc.body;
  vi.stubGlobal("document", doc);
});
afterEach(() => {
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  vi.unstubAllGlobals();
});
async function setup(captured = false) {
  const report = archiveReportFixture();
  const bytes = archiveBytes(archiveHtmlFixture(report));
  const sourceListeners = new Set<() => void>();
  const reports = new PortfolioReviewReportController(
    {
      capture: () => ({ report, current: () => true }),
      subscribe: (listener) => {
        sourceListeners.add(listener);
        return () => sourceListeners.delete(listener);
      },
    },
    undefined,
    () => null,
  );
  const revisit = new PortfolioReportRevisit(reports);
  const file = {
    name: "private <script>full original</script>.html",
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  };
  revisit.choose(file);
  await revisit.read();
  reports.prepare();
  revisit.compare();
  const deliver = vi.fn().mockResolvedValue("written");
  const format = vi.fn(() => ({
    purpose: "investment.portfolio-comparison-html" as const,
    filename: "invented.html",
    text: "fixture",
    byteLength: 7,
  }));
  const controller = new PortfolioComparisonReportController(
    {
      capture: () =>
        revisit.captureComparisonReport("2026-10-30T12:00:00.000Z"),
      subscribe: revisit.subscribe,
    },
    { deliver },
    format,
  );
  if (captured) controller.prepare();
  let tree: React.ReactNode;
  const render = () => {
    hooks.index = 0;
    hooks.effects = [];
    tree = PortfolioComparisonReportView({
      revisit,
      controller,
      delivery: { deliver },
    });
    attach(tree);
    hooks.effects.splice(0).forEach((effect) => effect());
    return load(renderToStaticMarkup(tree));
  };
  const get = (id: string) =>
    elements(tree).find((item) => item.props.id === id)!;
  const click = (id: string) => {
    const item = get(id);
    expect(item.props.disabled).not.toBe(true);
    const opener = nodes.get(id)!;
    focus(opener);
    (item.props.onClick as (event: unknown) => void)({ currentTarget: opener });
  };
  render();
  return {
    refreshSource: () => {
      for (const listener of sourceListeners) listener();
    },
    report,
    reports,
    revisit,
    file,
    controller,
    deliver,
    format,
    render,
    get,
    click,
    tree: () => tree,
  };
}

describe("private Portfolio comparison report controls", () => {
  it("enables a fresh capture from admitted provenance after source activity expires the old file selection", async () => {
    const f = await setup();
    f.refreshSource();
    expect(f.revisit.getSnapshot().filename).toBe("");
    expect(f.revisit.getSnapshot().savedFilename).toBe(f.file.name);
    f.reports.prepare();
    expect(f.revisit.compare()).toBe(true);
    f.render();
    expect(f.get("portfolio-comparison-report-capture").props.disabled).toBe(
      false,
    );
    f.click("portfolio-comparison-report-capture");
    f.render();
    expect(f.controller.getSnapshot().report?.savedFilename).toBe(f.file.name);
    expect(doc.activeElement).toBe(
      nodes.get("portfolio-comparison-report-heading"),
    );
    expect(f.deliver).not.toHaveBeenCalled();
  });

  it("separates capture, complete passive preview and save, with escaped data and unique IDs", async () => {
    const f = await setup();
    expect(f.get("portfolio-comparison-report-save")).toBeUndefined();
    f.click("portfolio-comparison-report-capture");
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.format).not.toHaveBeenCalled();
    expect(nodes.has("portfolio-comparison-report-heading")).toBe(false);
    const html = f.render();
    expect(doc.activeElement).toBe(
      nodes.get("portfolio-comparison-report-heading"),
    );
    expect(html("script")).toHaveLength(0);
    expect(html.text()).toContain(f.file.name);
    const captured = f.controller.getSnapshot().report!;
    expect(
      JSON.parse(html("[data-portfolio-comparison-document]").text()),
    ).toEqual(captured);
    expect(captured.comparison).toBe(f.revisit.getSnapshot().comparison);
    const all = load(
      renderToStaticMarkup(
        <>
          <PortfolioReviewReportSnapshot report={f.report} />
          {f.tree()}
        </>,
      ),
    );
    const ids = all("[id]")
      .map((_i, item) => all(item).attr("id"))
      .get();
    expect(new Set(ids).size).toBe(ids.length);
    expect(all("#portfolio-comparison-report-preview button")).toHaveLength(2);
    expect(all("#portfolio-comparison-report-preview").text()).not.toContain(
      "Research company",
    );
    f.click("portfolio-comparison-report-save");
    await Promise.resolve();
    await Promise.resolve();
    expect(f.deliver).toHaveBeenCalledTimes(1);
    expect(f.format).toHaveBeenCalledTimes(1);
    f.render();
    expect(f.controller.getSnapshot().message).toContain("written");
  });
  it("does not focus an already-present preview on mount or a later resource render", async () => {
    const f = await setup(true);
    f.render();
    expect(
      nodes.get("portfolio-comparison-report-heading")?.focus,
    ).not.toHaveBeenCalled();
  });
  it("keeps queued capture focus with its initiating action", async () => {
    const f = await setup();
    f.click("portfolio-comparison-report-capture");
    focus({ focus: vi.fn(), isConnected: true });
    focus(doc.body);
    f.render();
    expect(
      nodes.get("portfolio-comparison-report-heading")?.focus,
    ).not.toHaveBeenCalled();
  });
  it("rejects a stale capture handler after the exact saved file is replaced", async () => {
    const f = await setup();
    const handler = f.get("portfolio-comparison-report-capture").props
      .onClick as (e: unknown) => void;
    f.revisit.choose(f.file);
    handler({
      currentTarget: nodes.get("portfolio-comparison-report-capture"),
    });
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.deliver).not.toHaveBeenCalled();
  });
  it("does not publish focus after a reentrant source replacement during capture", async () => {
    const f = await setup();
    const unsubscribe = f.controller.subscribe(() => {
      if (f.controller.getSnapshot().report) f.revisit.choose(f.file);
    });
    f.click("portfolio-comparison-report-capture");
    f.render();
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(nodes.has("portfolio-comparison-report-heading")).toBe(false);
    unsubscribe();
  });
  it("returns focus only on the explicit current close action and leaves the comparison intact", async () => {
    const f = await setup();
    f.click("portfolio-comparison-report-capture");
    f.render();
    const comparison = f.revisit.getSnapshot().comparison;
    f.click("portfolio-comparison-report-close");
    expect(doc.activeElement).toBe(
      nodes.get("portfolio-comparison-report-capture"),
    );
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.revisit.getSnapshot().comparison).toBe(comparison);
  });
  it("rejects retained handlers after the view unmounts", async () => {
    const f = await setup();
    const handler = f.get("portfolio-comparison-report-capture").props
      .onClick as (e: unknown) => void;
    for (const slot of hooks.slots)
      (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
    handler({
      currentTarget: nodes.get("portfolio-comparison-report-capture"),
    });
    expect(f.controller.getSnapshot().report).toBeNull();
  });
});
